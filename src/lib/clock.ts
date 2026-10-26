'use client'

import { useEffect, useState } from 'react'

/**
 * Verbleibende Sekunden bis deadline (Serverzeit). serverNow stammt aus derselben
 * Meldung; die Differenz zur Geräteuhr gleicht falsch gehende Uhren aus.
 * null = kein Timer (oder noch nicht im Browser berechnet).
 */
export function useCountdown(deadline: number | null, serverNow: number) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!deadline) return
    const offset = serverNow - Date.now()
    const tick = () => setLeft(Math.max(0, (deadline - (Date.now() + offset)) / 1000))
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 200)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [deadline, serverNow])
  return deadline ? left : null
}
