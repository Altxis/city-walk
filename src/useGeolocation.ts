import { useEffect, useState } from 'react'

export type Position = { lat: number; lng: number; accuracy: number }

/** Следит за позицией пользователя, пока enabled === true. */
export function useGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<Position | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setError('Браузер не поддерживает геолокацию')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null)
        setPosition({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        })
      },
      (e) => setError(e.message || 'Не удалось получить геолокацию'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])

  return { position, setPosition, error }
}
