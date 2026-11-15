import { useEffect, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { POINTS, type Point } from './points'
import { distanceMeters } from './geo'
import { useGeolocation, type Position } from './useGeolocation'
import { beep, keepScreenOn, requestNotificationPermission, systemNotify, unlockAudio, vibrate } from './alerts'

const params = new URLSearchParams(location.search)
const ADMIN = params.has('admin') // клик по карте = новая точка
const DEBUG = params.has('debug') // клик по карте = «переместить» пользователя

/** Позиции с точностью хуже этой не триггерят уведомления — защита от ложных срабатываний. */
const MAX_ACCURACY_M = 100
/** Выход из зоны засчитывается на 20% дальше радиуса, чтобы не мигало на границе. */
const EXIT_FACTOR = 1.2

export default function App() {
  const [walking, setWalking] = useState(false)
  const { position, setPosition, error } = useGeolocation(walking && !DEBUG)
  const [alert, setAlert] = useState<Point | null>(null)
  const inside = useRef(new Set<string>())
  const [drafts, setDrafts] = useState<Point[]>([])

  // Держим экран включённым во время прогулки
  useEffect(() => (walking ? keepScreenOn() : undefined), [walking])

  // Проверяем вход в зоны при каждом обновлении позиции
  useEffect(() => {
    if (!position || position.accuracy > MAX_ACCURACY_M) return
    for (const p of POINTS) {
      const d = distanceMeters(position, p)
      if (d <= p.radius && !inside.current.has(p.id)) {
        inside.current.add(p.id)
        setAlert(p)
        beep()
        vibrate()
        if (document.hidden) systemNotify(p.title, p.description)
      } else if (d > p.radius * EXIT_FACTOR) {
        inside.current.delete(p.id)
      }
    }
  }, [position])

  const start = () => {
    unlockAudio()
    setWalking(true)
    void requestNotificationPermission() // не ждём ответа — прогулка стартует сразу
  }

  return (
    <div className="app">
      <MapContainer center={[POINTS[0].lat, POINTS[0].lng]} zoom={15} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {POINTS.map((p) => (
          <Circle
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.radius}
            pathOptions={{ color: '#e4572e' }}
            interactive={!DEBUG && !ADMIN} // в debug/admin клик должен доходить до карты
          >
            <Popup>
              <b>{p.title}</b>
              <br />
              {p.description}
            </Popup>
          </Circle>
        ))}
        {position && <UserMarker position={position} />}
        {DEBUG && <ClickHandler onClick={(lat, lng) => setPosition({ lat, lng, accuracy: 5 })} />}
        {ADMIN && <ClickHandler onClick={(lat, lng) => setDrafts((d) => [...d, newDraft(lat, lng, d.length)])} />}
        {drafts.map((p) => (
          <Circle key={p.id} center={[p.lat, p.lng]} radius={p.radius} pathOptions={{ color: '#10ac84', dashArray: '4' }} />
        ))}
      </MapContainer>

      {ADMIN && <AdminPanel drafts={drafts} onClear={() => setDrafts([])} />}

      {!walking && !ADMIN && (
        <button className="start" onClick={start}>
          Начать прогулку
        </button>
      )}

      {walking && (
        <div className="status">
          {error
            ? `⚠️ ${error}`
            : DEBUG
              ? 'Режим отладки: кликните по карте, чтобы переместиться'
              : position
                ? `Точность GPS: ±${Math.round(position.accuracy)} м`
                : 'Определяем местоположение…'}
        </div>
      )}

      {alert && (
        <div className="alert" onClick={() => setAlert(null)}>
          <div className="alert-title">📍 {alert.title}</div>
          <div>{alert.description}</div>
          <div className="alert-hint">Нажмите, чтобы закрыть</div>
        </div>
      )}
    </div>
  )
}

function UserMarker({ position }: { position: Position }) {
  const map = useMap()
  const centered = useRef(false)
  useEffect(() => {
    // Центрируем карту на пользователе один раз — дальше он двигает её сам
    if (!centered.current) {
      map.setView([position.lat, position.lng], 17)
      centered.current = true
    }
  }, [map, position])
  return (
    <>
      <Circle
        center={[position.lat, position.lng]}
        radius={position.accuracy}
        pathOptions={{ color: '#2e86de', weight: 0, fillOpacity: 0.15 }}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={8}
        pathOptions={{ color: '#fff', weight: 3, fillColor: '#2e86de', fillOpacity: 1 }}
      />
    </>
  )
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

function newDraft(lat: number, lng: number, index: number): Point {
  return {
    id: `point-${Date.now()}`,
    title: `Новая точка ${index + 1}`,
    description: '',
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    radius: 50,
  }
}

/** ?admin — кликаем по карте, получаем код точек для вставки в points.ts */
function AdminPanel({ drafts, onClear }: { drafts: Point[]; onClear: () => void }) {
  const code = drafts.map((p) => JSON.stringify(p, null, 2)).join(',\n')
  return (
    <div className="admin">
      <b>Админ:</b> кликайте по карте, затем вставьте код в <code>src/points.ts</code>
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
