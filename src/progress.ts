// Прогресс по маршрутам хранится в localStorage, чтобы перезагрузка страницы
// посреди прогулки не сбрасывала пройденные остановки.

const key = (routeId: string) => `city-walk:visited:${routeId}`

export function loadVisited(routeId: string): string[] {
  try {
    const raw = localStorage.getItem(key(routeId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveVisited(routeId: string, visited: string[]) {
  try {
    localStorage.setItem(key(routeId), JSON.stringify(visited))
  } catch {
    /* приватный режим и т.п. — прогресс просто не сохранится */
  }
}
