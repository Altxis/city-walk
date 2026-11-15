export type Point = {
  id: string
  title: string
  description: string
  lat: number
  lng: number
  /** Радиус срабатывания в метрах */
  radius: number
}

// Точки захардкожены. Чтобы добавить новую — откройте приложение с ?admin,
// кликните по карте и вставьте сгенерированный объект сюда.
export const POINTS: Point[] = [
  {
    id: 'red-square',
    title: 'Красная площадь',
    description: 'Главная площадь Москвы.',
    lat: 55.75393,
    lng: 37.620795,
    radius: 80,
  },
  {
    id: 'bolshoi',
    title: 'Большой театр',
    description: 'Один из крупнейших театров оперы и балета.',
    lat: 55.760186,
    lng: 37.618711,
    radius: 50,
  },
  {
    id: 'zaryadye',
    title: 'Парк «Зарядье»',
    description: 'Парящий мост над Москвой-рекой.',
    lat: 55.751244,
    lng: 37.628875,
    radius: 100,
  },
]
