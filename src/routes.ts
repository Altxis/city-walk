import { distanceMeters } from './geo'

export type Stop = {
  id: string
  title: string
  address: string
  lat: number
  lng: number
  /** Радиус срабатывания в метрах */
  radius: number
}

export type Route = {
  id: string
  title: string
  /** id остановок в порядке прохождения */
  stopIds: string[]
}

// Координаты из OpenStreetMap (Nominatim). Новую точку удобно получить через ?admin.
export const STOPS: Record<string, Stop> = {
  perchel: {
    id: 'perchel',
    title: 'Estación El Perchel',
    address: 'Explanada de la Estación',
    lat: 36.712795,
    lng: -4.432426,
    radius: 50,
  },
  carmen: {
    id: 'carmen',
    title: 'Mercado El Carmen',
    address: 'Calle La Serna, 3',
    lat: 36.713894,
    lng: -4.429727,
    radius: 40,
  },
  'santo-domingo': {
    id: 'santo-domingo',
    title: 'Iglesia de Santo Domingo',
    address: 'Pasillo de Santo Domingo, 5',
    lat: 36.719614,
    lng: -4.426067,
    radius: 25, // в ~55 м от моста — радиусы маленькие, чтобы зоны не пересекались
  },
  alemanes: {
    id: 'alemanes',
    title: 'Puente de los Alemanes',
    address: 'Puente de Santo Domingo',
    lat: 36.71932,
    lng: -4.425552,
    radius: 25,
  },
  atarazanas: {
    id: 'atarazanas',
    title: 'Mercado de Atarazanas',
    address: 'Calle Atarazanas, 10',
    lat: 36.718408,
    lng: -4.424061,
    radius: 40,
  },
  martires: {
    id: 'martires',
    title: 'Plaza de los Mártires Ciriaco y Paula',
    address: 'Plaza de los Mártires',
    lat: 36.722337,
    lng: -4.422235,
    radius: 35,
  },
  chinitas: {
    id: 'chinitas',
    title: 'Pasaje de Chinitas',
    address: 'Pasaje de Chinitas',
    lat: 36.720938,
    lng: -4.421258,
    radius: 30,
  },
  obispo: {
    id: 'obispo',
    title: 'Plaza del Obispo',
    address: 'Plaza del Obispo',
    lat: 36.720124,
    lng: -4.420282,
    radius: 40,
  },
  merced: {
    id: 'merced',
    title: 'Plaza de la Merced',
    address: 'Plaza de la Merced',
    lat: 36.723381,
    lng: -4.417543,
    radius: 50,
  },
}

export const ROUTES: Route[] = [
  {
    id: 'full',
    title: 'Полный маршрут',
    stopIds: ['perchel', 'carmen', 'santo-domingo', 'alemanes', 'atarazanas', 'martires', 'chinitas', 'obispo', 'merced'],
  },
  {
    id: 'short',
    title: 'Короткий маршрут',
    stopIds: ['perchel', 'carmen', 'alemanes', 'atarazanas', 'martires', 'chinitas'],
  },
]

export function routeStops(route: Route): Stop[] {
  return route.stopIds.map((id) => {
    const stop = STOPS[id]
    if (!stop) throw new Error(`Маршрут ${route.id}: неизвестная остановка ${id}`)
    return stop
  })
}

/** Длина маршрута по прямой между остановками, в метрах (реальный путь по улицам длиннее). */
export function routeLength(route: Route): number {
  const stops = routeStops(route)
  let sum = 0
  for (let i = 1; i < stops.length; i++) sum += distanceMeters(stops[i - 1], stops[i])
  return sum
}
