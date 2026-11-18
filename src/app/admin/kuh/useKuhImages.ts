'use client'

import { useCallback, useEffect, useState } from 'react'

export type KuhImg = { id: string; n: number; url: string }

/** Bilder der Kreativ-Challenge (älteste zuerst, n = Nummer) mit regelmässigem Nachladen. */
export function useKuhImages(pollMs = 6000) {
  const [images, setImages] = useState<KuhImg[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/kuh', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { images: KuhImg[] }
      setImages(data.images)
      setLoaded(true)
    } catch {
      // Beim nächsten Durchlauf nochmals versuchen.
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void reload(), 0)
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void reload()
    }, pollMs)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [reload, pollMs])

  return { images, setImages, loaded, reload }
}
