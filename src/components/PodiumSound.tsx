'use client'

import { useEffect } from 'react'
import { MOO_AT } from '@/lib/podium-timing'

export const WINNER_SOUND = '/sounds/sieger.mp3'
export const MOO_SOUND = '/sounds/muh.mp3'

/**
 * Siegermelodie zum Podest, nur im Beamer-Fenster. Startet mit der Animation:
 * Der laute Teil der Melodie setzt nach gut vier Sekunden ein, genau wenn
 * Platz 1 erscheint. Blockiert der Browser den Ton (noch kein Klick im
 * Fenster), bleibt es still; die Animation läuft trotzdem.
 */
export function PodiumSound({ moo = false }: { moo?: boolean }) {
  useEffect(() => {
    const audio = new Audio(WINNER_SOUND)
    audio.play().catch(() => { /* Autoplay gesperrt: ohne Ton weiter */ })
    // Kreativ-Challenge: die Kuh muht, wenn die Melodie ausklingt.
    const cow = moo ? new Audio(MOO_SOUND) : null
    const t = cow ? setTimeout(() => { cow.play().catch(() => {}) }, MOO_AT * 1000) : null
    return () => {
      audio.pause()
      if (t) clearTimeout(t)
      cow?.pause()
    }
  }, [moo])
  return null
}
