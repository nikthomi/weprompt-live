'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import cloud from 'd3-cloud'
import type { WordResult } from '@/lib/types'

type CloudWord = cloud.Word & { key: string; color: string }
type Placed = { key: string; text: string; size: number; x: number; y: number; color: string }

// Markenfarben auf violett: weiss, amber, mist (coral bleibt Handlungsfarbe).
const COLORS = ['#ffffff', '#f6ca70', '#f2f0ed']

/** Deterministischer Zufall, damit das Layout bei jeder Aktualisierung ruhig bleibt. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Wortwolke mit d3-cloud: Wörter überlappen nie, häufige Begriffe sind grösser.
 * Das Layout wird höchstens alle 1.2 s neu berechnet; Positionen gleiten per CSS.
 * Was nicht mehr Platz hat, wird kleiner skaliert statt weggelassen.
 */
export function WordCloud({ words }: { words: WordResult[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [placed, setPlaced] = useState<Placed[]>([])
  const [fontFamily, setFontFamily] = useState('sans-serif')

  useEffect(() => {
    const el = box.current
    if (!el) return
    setFontFamily(getComputedStyle(el).fontFamily)
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const visible = useMemo(() => words.filter(w => !w.hidden).slice(0, 120), [words])
  const signature = visible.map(w => `${w.key}:${w.count}`).join('|')

  const lastRun = useRef(0)
  useEffect(() => {
    if (!size.w || !size.h) return
    if (!visible.length) return
    let cancelled = false
    let layout: ReturnType<typeof cloud<CloudWord>> | null = null
    const wait = Math.max(0, 1200 - (Date.now() - lastRun.current))

    const run = (scale: number) => {
      const maxCount = Math.max(...visible.map(w => w.count))
      const base = Math.min(size.w, size.h)
      const maxFont = base * 0.22 * scale
      const minFont = Math.max(12, base * 0.045 * scale)
      const input = visible.map((w, i) => ({
        key: w.key, text: w.text, color: COLORS[i % COLORS.length],
        size: minFont + (maxFont - minFont) * Math.sqrt(w.count / maxCount),
      }))
      const next = cloud<CloudWord>()
        .size([size.w, size.h])
        .words(input.map(w => ({ ...w })))
        .padding(Math.max(3, base * 0.012))
        .rotate(0)
        .font(fontFamily)
        .fontWeight(600)
        .fontSize(d => d.size!)
        .random(seeded(visible.length))
        .spiral('archimedean')
        .on('end', out => {
          if (cancelled) return
          // Nicht alles untergebracht: kleiner versuchen (höchstens dreimal).
          if (out.length < input.length && scale > 0.5) return run(scale * 0.82)
          lastRun.current = Date.now()
          setPlaced(out.map(d => ({ key: d.key, text: d.text!, size: d.size!, x: d.x!, y: d.y!, color: d.color })))
        })
      layout = next
      next.start()
    }

    const t = setTimeout(() => {
      document.fonts.ready.then(() => { if (!cancelled) run(1) })
    }, wait)
    return () => { cancelled = true; clearTimeout(t); layout?.stop() }
    // signature fasst die Wörter zusammen; visible selbst ändert sich bei jedem Abruf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, size.w, size.h, fontFamily])

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden font-[family-name:var(--font-brand)]" aria-label="Wortwolke">
      <ul className="sr-only">{visible.map(w => <li key={w.key}>{w.text}: {w.count}</li>)}</ul>
      <div aria-hidden>
        {(visible.length ? placed : []).map(p => (
          <span
            key={p.key}
            className="cloud-word wp-fade absolute left-1/2 top-1/2 whitespace-nowrap font-semibold leading-none"
            style={{
              fontSize: p.size,
              color: p.color,
              transform: `translate(calc(${p.x}px - 50%), calc(${p.y}px - 50%))`,
            }}
          >
            {p.text}
          </span>
        ))}
      </div>
    </div>
  )
}
