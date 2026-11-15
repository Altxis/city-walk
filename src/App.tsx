import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { ROUTES, STOPS, routeLength, routeStops, type Route, type Stop } from './routes'
import { distanceMeters } from './geo'
import { useGeolocation, type Position } from './useGeolocation'
import { loadVisited, saveVisited } from './progress'
import { beep, keepScreenOn, requestNotificationPermission, systemNotify, unlockAudio, vibrate } from './alerts'

const params = new URLSearchParams(location.search)
const ADMIN = params.has('admin') // клик по карте = новая точка
const DEBUG = params.has('debug') // клик по карте = «переместить» пользователя
const INTERACTIVE = !ADMIN && !DEBUG // в debug/admin клики по точкам должны доходить до карты

/** Позиции с точностью хуже этой не триггерят уведомления — защита от ложных срабатываний. */
const MAX_ACCURACY_M = 100

const ALL_STOPS = Object.values(STOPS)

export default function App() {
  const [route, setRoute] = useState<Route | null>(null)
  const [visited, setVisited] = useState<string[]>([])
  const [alert, setAlert] = useState<Stop | null>(null)
  const [drafts, setDrafts] = useState<Stop[]>([])
  const { position, setPosition, error } = useGeolocation(route !== null && !DEBUG)

  const stops = useMemo(() => (route ? routeStops(route) : []), [route])
  const next = stops.find((s) => !visited.includes(s.id)) ?? null
  const finished = route !== null && next === null

  // Держим экран включённым, пока идём по маршруту
  useEffect(() => (route ? keepScreenOn() : undefined), [route])

  // Проверяем вход в зоны непройденных остановок при каждом обновлении позиции.
  // Засчитываем любую остановку маршрута, даже если пользователь срезал порядок.
  useEffect(() => {
    if (!route || !position || position.accuracy > MAX_ACCURACY_M) return
    const entered = stops.filter((s) => !visited.includes(s.id) && distanceMeters(position, s) <= s.radius)
    if (entered.length === 0) return
    const updated = [...visited, ...entered.map((s) => s.id)]
    setVisited(updated)
    saveVisited(route.id, updated)
    const stop = entered[0]
    setAlert(stop)
    beep()
    vibrate()
    if (document.hidden) systemNotify(stop.title, stop.address)
    // visited/stops намеренно не в зависимостях: проверяем только при новой позиции
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position])

  const pickRoute = (r: Route) => {
    unlockAudio() // клик по маршруту — жест пользователя, разблокируем звук
    void requestNotificationPermission()
    setVisited(loadVisited(r.id))
    setAlert(null)
    setRoute(r)
  }

  const resetProgress = () => {
    if (!route) return
    setVisited([])
    saveVisited(route.id, [])
    setAlert(null)
  }

  const shownStops = route ? stops : ALL_STOPS

  return (
    <div className="app">
      <MapContainer center={[ALL_STOPS[0].lat, ALL_STOPS[0].lng]} zoom={15} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds stops={shownStops} />
        {route && (
          <Polyline
            positions={stops.map((s) => [s.lat, s.lng])}
            pathOptions={{ color: '#e4572e', weight: 3, dashArray: '6 8', opacity: 0.7 }}
            interactive={false}
          />
        )}
        {shownStops.map((s, i) => {
          const state = !route ? 'idle' : visited.includes(s.id) ? 'done' : s.id === next?.id ? 'next' : 'todo'
          return (
            <StopMarker key={s.id} stop={s} label={route ? String(i + 1) : ''} state={state} />
          )
        })}
        {position && <UserMarker position={position} />}
        {DEBUG && route && <ClickHandler onClick={(lat, lng) => setPosition({ lat, lng, accuracy: 5 })} />}
        {ADMIN && <ClickHandler onClick={(lat, lng) => setDrafts((d) => [...d, newDraft(lat, lng, d.length)])} />}
        {drafts.map((p) => (
          <Circle key={p.id} center={[p.lat, p.lng]} radius={p.radius} pathOptions={{ color: '#10ac84', dashArray: '4' }} />
        ))}
      </MapContainer>

      {ADMIN && <AdminPanel drafts={drafts} onClear={() => setDrafts([])} />}

      {!ADMIN && !route && <RoutePicker onPick={pickRoute} />}

      {route && (
        <div className="status">
          {error
            ? `⚠️ ${error}`
            : DEBUG
              ? 'Отладка: кликните по карте, чтобы переместиться'
              : position
                ? `Точность GPS: ±${Math.round(position.accuracy)} м`
                : 'Определяем местоположение…'}
        </div>
      )}

      {route && !alert && (
        <div className="panel">
          <div className="progress">
            <div className="progress-bar" style={{ width: `${(visited.length / stops.length) * 100}%` }} />
          </div>
          <div className="panel-meta">
            {route.title} · {Math.min(visited.length, stops.length)} из {stops.length}
          </div>
          {finished ? (
            <div className="panel-title">🎉 Маршрут пройден!</div>
          ) : (
            next && (
              <>
                <div className="panel-title">
                  Следующая: {stops.indexOf(next) + 1}. {next.title}
                </div>
                <div className="panel-meta">
                  {position ? `${formatDistance(distanceMeters(position, next))} по прямой` : next.address}
                </div>
              </>
            )
          )}
          <div className="panel-actions">
            <button onClick={() => setRoute(null)}>← Маршруты</button>
            {visited.length > 0 && <button onClick={resetProgress}>Начать заново</button>}
          </div>
        </div>
      )}

      {alert && (
        <div className="alert" onClick={() => setAlert(null)}>
          <div className="alert-meta">
            Остановка {stops.indexOf(alert) + 1} из {stops.length}
          </div>
          <div className="alert-title">📍 {alert.title}</div>
          <div>{alert.address}</div>
          <div className="alert-hint">Нажмите, чтобы продолжить</div>
        </div>
      )}
    </div>
  )
}

function RoutePicker({ onPick }: { onPick: (r: Route) => void }) {
  return (
    <div className="picker">
      <h1>Прогулка по Малаге</h1>
      <p>Выберите маршрут. Уведомление придёт, когда вы подойдёте к остановке — держите вкладку открытой.</p>
      {ROUTES.map((r) => {
        const done = loadVisited(r.id).length
        return (
          <button key={r.id} className="route-card" onClick={() => onPick(r)}>
            <span className="route-title">{r.title}</span>
            <span className="route-meta">
              {r.stopIds.length} остановок · ~{formatDistance(routeLength(r) * 1.3)}
              {done > 0 && ` · пройдено ${Math.min(done, r.stopIds.length)}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function StopMarker({ stop, label, state }: { stop: Stop; label: string; state: 'idle' | 'done' | 'next' | 'todo' }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<div class="stop-pin stop-${state}">${state === 'done' ? '✓' : label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    [label, state],
  )
  return (
    <>
      <Circle
        center={[stop.lat, stop.lng]}
        radius={stop.radius}
        pathOptions={{ color: state === 'done' ? '#10ac84' : '#e4572e', weight: 1, fillOpacity: 0.12 }}
        interactive={false}
      />
      <Marker position={[stop.lat, stop.lng]} icon={icon} interactive={INTERACTIVE}>
        <Popup>
          <b>{stop.title}</b>
          <br />
          {stop.address}
        </Popup>
      </Marker>
    </>
  )
}

/** Подгоняет карту под набор остановок при его смене. */
function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap()
  useEffect(() => {
    if (stops.length === 0) return
    // Снизу отступ больше: там панель выбора маршрута / прогресса
    map.fitBounds(L.latLngBounds(stops.map((s) => [s.lat, s.lng])), {
      paddingTopLeft: [30, 60],
      paddingBottomRight: [30, 260],
    })
  }, [map, stops])
  return null
}

function UserMarker({ position }: { position: Position }) {
  return (
    <>
      <Circle
        center={[position.lat, position.lng]}
        radius={position.accuracy}
        pathOptions={{ color: '#2e86de', weight: 0, fillOpacity: 0.15 }}
        interactive={false}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={8}
        pathOptions={{ color: '#fff', weight: 3, fillColor: '#2e86de', fillOpacity: 1 }}
        interactive={false}
      />
    </>
  )
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(1)} км`
}

function newDraft(lat: number, lng: number, index: number): Stop {
  return {
    id: `stop-${Date.now()}`,
    title: `Новая точка ${index + 1}`,
    address: '',
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    radius: 40,
  }
}

/** ?admin — кликаем по карте, получаем код остановок для вставки в STOPS в routes.ts */
function AdminPanel({ drafts, onClear }: { drafts: Stop[]; onClear: () => void }) {
  const code = drafts.map((p) => `'${p.id}': ${JSON.stringify(p, null, 2)},`).join('\n')
  return (
    <div className="admin">
      <b>Админ:</b> кликайте по карте, затем вставьте код в <code>STOPS</code> в <code>src/routes.ts</code> и добавьте id
      в нужный маршрут
      {drafts.length > 0 && (
        <>
          <textarea readOnly value={code} />
          <button onClick={() => navigator.clipboard.writeText(code)}>Скопировать</button>
          <button onClick={onClear}>Очистить</button>
        </>
      )}
    </div>
  )
}
