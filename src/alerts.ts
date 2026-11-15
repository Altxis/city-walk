// Звук, вибрация, системные уведомления и удержание экрана.

let audioCtx: AudioContext | null = null

/** Вызывать из обработчика клика: браузеры разрешают звук только после жеста пользователя. */
export function unlockAudio() {
  audioCtx ??= new AudioContext()
  void audioCtx.resume()
}

export function beep() {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6)
  osc.connect(gain).connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + 0.6)
}

export function vibrate() {
  navigator.vibrate?.([200, 100, 200]) // на iOS не поддерживается
}

export async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

export function systemNotify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch {
      // Android Chrome требует service worker для new Notification — там хватит in-app карточки
    }
  }
}

/** Не даёт экрану погаснуть, пока вкладка открыта. Возвращает функцию отключения. */
export function keepScreenOn(): () => void {
  if (!('wakeLock' in navigator)) return () => {}
  let lock: WakeLockSentinel | null = null
  let active = true
  const acquire = async () => {
    try {
      lock = await navigator.wakeLock.request('screen')
    } catch {
      /* батарея/настройки могут запретить — не критично */
    }
  }
  // Блокировка снимается при сворачивании вкладки — берём заново при возврате
  const onVisible = () => {
    if (active && document.visibilityState === 'visible') void acquire()
  }
  void acquire()
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    active = false
    document.removeEventListener('visibilitychange', onVisible)
    void lock?.release()
  }
}
