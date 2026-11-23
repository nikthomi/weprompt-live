'use client'

import { useEffect } from 'react'

export const WINNER_SOUND = '/sounds/sieger.mp3'

/**
 * Siegermelodie zum Podest, nur im Beamer-Fenster. Startet mit der Animation:
 * Der laute Teil der Melodie setzt nach gut vier Sekunden ein, genau wenn
 * Platz 1 erscheint. Blockiert der Browser den Ton (noch kein Klick im
 * Fenster), bleibt es still; die Animation läuft trotzdem.
 */
export function PodiumSound() {
  useEffect(() => {
    const audio = new Audio(WINNER_SOUND)
    audio.play().catch(() => { /* Autoplay gesperrt: ohne Ton weiter */ })
    return () => { audio.pause() }
  }, [])
  return null
}
