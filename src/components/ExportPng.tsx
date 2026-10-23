'use client'

import { useState, type RefObject } from 'react'

/** Speichert ein Element (z. B. die Ergebnis-Bühne) als PNG in Full-HD-Breite. */
export function ExportPng({ target, filename, label = 'Als PNG' }: { target: RefObject<HTMLElement | null>; filename: string; label?: string }) {
  const [busy, setBusy] = useState(false)
  async function run() {
    const el = target.current
    if (!el) return
    setBusy(true)
    try {
      const { toPng } = await import('html-to-image')
      const url = await toPng(el, { pixelRatio: 1920 / el.offsetWidth, cacheBust: true })
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
    } finally {
      setBusy(false)
    }
  }
  return <button type="button" className="wp-btn-quiet" onClick={run} disabled={busy}>{busy ? 'Exportieren …' : label}</button>
}

export const pngName = (title: string, suffix: string) =>
  `weprompt-live_${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 50)}_${suffix}.png`
