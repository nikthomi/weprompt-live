'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useKuhImages, type KuhImg } from '../useKuhImages'

const GAP = 14
const CELL_ASPECT = 4 / 3
const AUTO_MS = 7000
const STORE = 'kuh-punkte-v1'

/** Beste Spaltenzahl: grösste Kachel, bei der alle Bilder ohne Scrollen in den Bereich passen. */
function bestGrid(n: number, w: number, h: number) {
  let best = { cols: 1, rows: Math.max(1, n), width: 0 }
  if (n <= 0 || w <= 0 || h <= 0) return best
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const cellW = (w - GAP * (cols - 1)) / cols
    const cellH = (h - GAP * (rows - 1)) / rows
    const width = Math.floor(Math.min(cellW, cellH * CELL_ASPECT))
    if (width > best.width) best = { cols, rows, width }
  }
  return best
}

function useSize() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, size] as const
}

type Phase = 'single' | 'gallery' | 'podium'
type Votes = { points: Record<string, number>; history: string[] }
const NO_VOTES: Votes = { points: {}, history: [] }

const RANK_COLORS = ['#f6ca70', '#ffffff', '#f64462'] // Gold, Silber, Bronze im WePrompt-Farbraum

export function Praesentation() {
  const { images } = useKuhImages(6000)
  const [phase, setPhase] = useState<Phase>('single')
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(false)
  const [votes, setVotes] = useState<Votes>(NO_VOTES)
  const [votesReady, setVotesReady] = useState(false)
  const [areaRef, area] = useSize()
  const router = useRouter()

  // Punkte aus dem Browser laden (überleben ein Neuladen) und bei jeder Änderung sichern.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORE)
        if (raw) setVotes(JSON.parse(raw) as Votes)
      } catch {
        // Ohne Speicher geht es trotzdem, nur ohne Wiederherstellung.
      }
      setVotesReady(true)
    }, 0)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!votesReady) return
    try {
      localStorage.setItem(STORE, JSON.stringify(votes))
    } catch {
      // Ignorieren.
    }
  }, [votes, votesReady])

  const count = images.length
  const safeIndex = Math.min(index, Math.max(0, count - 1))
  const current = images[safeIndex]

  const pts = useCallback((id: string) => votes.points[id] ?? 0, [votes])
  const ranked: KuhImg[] = [...images].sort((a, b) => pts(b.id) - pts(a.id) || a.n - b.n)
  const total = images.reduce((s, i) => s + pts(i.id), 0)

  const vote = useCallback((id: string, d: 1 | -1) => {
    setVotes(v => {
      const cur = v.points[id] ?? 0
      if (d < 0) {
        if (cur <= 0) return v
        const history = [...v.history]
        const at = history.lastIndexOf(id)
        if (at >= 0) history.splice(at, 1)
        return { points: { ...v.points, [id]: cur - 1 }, history }
      }
      return { points: { ...v.points, [id]: cur + 1 }, history: [...v.history, id] }
    })
  }, [])

  const undo = useCallback(() => {
    setVotes(v => {
      const id = v.history[v.history.length - 1]
      if (!id) return v
      return { points: { ...v.points, [id]: Math.max(0, (v.points[id] ?? 0) - 1) }, history: v.history.slice(0, -1) }
    })
  }, [])

  const resetVotes = useCallback(() => {
    if (confirm('Alle Punkte zurücksetzen?')) setVotes(NO_VOTES)
  }, [])

  const next = useCallback(() => {
    if (phase !== 'single') return
    if (safeIndex >= count - 1) setPhase('gallery')
    else setIndex(safeIndex + 1)
  }, [phase, safeIndex, count])

  const prev = useCallback(() => {
    if (phase === 'podium') setPhase('gallery')
    else if (phase === 'gallery') {
      setPhase('single')
      setIndex(Math.max(0, count - 1))
    } else setIndex(Math.max(0, safeIndex - 1))
  }, [phase, safeIndex, count])

  const toFinish = useCallback(() => {
    if (total > 0) setPhase('podium')
  }, [total])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev() }
      else if (e.key === 'g' || e.key === 'G') setPhase(p => (p === 'single' ? 'gallery' : p === 'gallery' ? 'single' : 'gallery'))
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      else if (e.key === 'a' || e.key === 'A') setAuto(a => !a)
      else if (e.key === 'Home') { setPhase('single'); setIndex(0) }
      else if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && phase === 'gallery') { e.preventDefault(); undo() }
      else if (e.key === 'Enter' && phase === 'gallery') toFinish()
      else if (e.key === 'Escape') router.push('/admin/kuh')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, toggleFullscreen, router, phase, undo, toFinish])

  // Automatikmodus: alle paar Sekunden weiter, am Ende bleibt die Galerie stehen.
  useEffect(() => {
    if (!auto || phase !== 'single') return
    const t = setTimeout(next, AUTO_MS)
    return () => clearTimeout(t)
  }, [auto, phase, next, safeIndex])

  const grid = bestGrid(count, area.w, area.h)
  const cellH = Math.floor(grid.width / CELL_ASPECT)
  const gridW = grid.cols * grid.width + (grid.cols - 1) * GAP
  const gridH = grid.rows * cellH + (grid.rows - 1) * GAP

  // Podest: Breiten aus dem verfügbaren Bereich, Höhen so, dass alles ohne Scrollen passt.
  const top3 = ranked.slice(0, 3)
  const P_GAP = 28
  const wTotal = Math.max(0, area.w - 2 * P_GAP)
  const s = Math.min(1, (0.56 * area.h) / ((0.4 * wTotal * 3) / 4 || 1))
  const wc = 0.4 * wTotal * s
  const ws = 0.3 * wTotal * s
  const rem = area.h - (wc * 3) / 4 - 76
  const p1 = Math.max(0.08 * area.h, Math.min(0.3 * area.h, rem * 0.85))
  const columns = [
    { img: top3[1], rank: 1, w: ws, ped: p1 * 0.66 },
    { img: top3[0], rank: 0, w: wc, ped: p1 },
    { img: top3[2], rank: 2, w: ws, ped: p1 * 0.42 },
  ]

  return (
    <div className="on-violett fixed inset-0 z-[100] flex select-none flex-col overflow-hidden bg-violett text-white">
      {count === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="t-h1">Noch keine Bilder</p>
          <Link href="/admin/kuh" className="wp-btn-quiet on-dark">Zurück</Link>
        </div>
      ) : phase === 'single' && current ? (
        <div
          className="relative flex flex-1 cursor-pointer items-center justify-center p-6 md:p-10"
          onClick={e => {
            const x = e.clientX / window.innerWidth
            if (x < 0.25) prev()
            else next()
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.id}
            src={current.url}
            alt={`Bild Nr. ${current.n}`}
            className="block rounded-[25px] object-contain"
            // Feste Grenzen in Viewport-Einheiten: Hoch- und Querformate passen immer ganz auf den Bildschirm.
            style={{ maxHeight: 'calc(100dvh - 130px)', maxWidth: 'calc(100vw - 80px)' }}
          />
          {/* Nächstes Bild vorladen, damit der Wechsel ohne Blitzen klappt. */}
          {images[safeIndex + 1] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[safeIndex + 1].url} alt="" className="hidden" aria-hidden />
          ) : null}
          <span className="absolute left-6 top-6 rounded-full bg-amber px-6 py-2 font-[family-name:var(--font-brand)] text-[clamp(22px,3vw,44px)] font-bold uppercase leading-none text-black">Nr. {current.n}</span>
          <span className="absolute right-6 top-6 rounded-full border-2 border-white px-5 py-1.5 font-[family-name:var(--font-brand)] text-[clamp(16px,1.8vw,28px)] font-semibold">{safeIndex + 1} / {count}</span>
        </div>
      ) : phase === 'gallery' ? (
        <>
          <header className="flex items-center justify-between gap-4 px-6 pb-3 pt-5 md:px-10">
            <h1 className="font-[family-name:var(--font-brand)] text-[clamp(22px,2.6vw,40px)] font-semibold leading-none">Die Kuh muss auf die Alp!</h1>
            <div className="flex items-center gap-3">
              <span className="rounded-full border-2 border-white px-5 py-1 font-[family-name:var(--font-brand)] text-[clamp(14px,1.5vw,24px)] font-semibold uppercase">
                {total} {total === 1 ? 'Punkt' : 'Punkte'}
              </span>
              <button type="button" className="wp-btn wp-btn-primary" disabled={total === 0} onClick={toFinish}>Fertig</button>
            </div>
          </header>
          <div ref={areaRef} className="min-h-0 flex-1 px-6 pb-14 md:px-10">
            <div className="flex h-full w-full items-center justify-center">
              <ul className="relative" style={{ width: gridW, height: gridH }}>
                {ranked.map((img, i) => {
                  const p = pts(img.id)
                  const rank = p > 0 && i < 3 ? i : -1
                  return (
                    <li
                      key={img.id}
                      className="absolute left-0 top-0 transition-transform duration-500 ease-out"
                      style={{ width: grid.width, height: cellH, transform: `translate(${(i % grid.cols) * (grid.width + GAP)}px, ${Math.floor(i / grid.cols) * (cellH + GAP)}px)` }}
                    >
                      <button
                        type="button"
                        aria-label={`Bild Nr. ${img.n}, ${p} ${p === 1 ? 'Punkt' : 'Punkte'}. Klick gibt einen Punkt, Umschalt plus Klick nimmt einen weg.`}
                        className="relative block h-full w-full cursor-pointer overflow-hidden rounded-[14px] bg-mist"
                        style={rank >= 0 ? { outline: `${Math.max(4, grid.width / 60)}px solid ${RANK_COLORS[rank]}`, outlineOffset: 2 } : undefined}
                        onClick={e => vote(img.id, e.shiftKey ? -1 : 1)}
                        onContextMenu={e => { e.preventDefault(); vote(img.id, -1) }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" draggable={false} className="block h-full w-full object-contain" />
                        <span className="absolute left-2 top-2 rounded-full bg-amber px-3 py-0.5 font-[family-name:var(--font-brand)] font-bold uppercase leading-5 text-black" style={{ fontSize: Math.max(11, Math.min(22, grid.width / 12)) }}>Nr. {img.n}</span>
                        {p > 0 ? (
                          <span
                            className="absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-coral font-[family-name:var(--font-brand)] font-bold leading-none text-white"
                            style={{ minWidth: Math.max(28, grid.width / 6), height: Math.max(28, grid.width / 6), padding: '0 8px', fontSize: Math.max(16, grid.width / 9) }}
                          >
                            {p}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <>
          <header className="flex items-center justify-between gap-4 px-6 pb-2 pt-5 md:px-10">
            <h1 className="font-[family-name:var(--font-brand)] text-[clamp(26px,3.4vw,56px)] font-semibold leading-none">Die Siegerbilder</h1>
            <span className="rounded-full border-2 border-white px-5 py-1 font-[family-name:var(--font-brand)] text-[clamp(14px,1.5vw,24px)] font-semibold uppercase">{total} {total === 1 ? 'Punkt' : 'Punkte'} vergeben</span>
          </header>
          <div ref={areaRef} className="min-h-0 flex-1 px-6 pb-14 md:px-10">
            <div className="flex h-full w-full items-end justify-center" style={{ gap: P_GAP }}>
              {columns.map(c =>
                c.img ? (
                  <div key={c.img.id} className="flex flex-col items-stretch" style={{ width: c.w }}>
                    <div
                      className="relative overflow-hidden bg-mist"
                      style={{ height: (c.w * 3) / 4, border: `${Math.max(8, c.w / 36)}px solid ${RANK_COLORS[c.rank]}`, borderRadius: 22, boxShadow: '0 14px 44px rgba(0,0,0,.4)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.img.url} alt={`Platz ${c.rank + 1}: Bild Nr. ${c.img.n}`} className="block h-full w-full object-contain" />
                    </div>
                    <div
                      className="mt-3 flex flex-col items-center justify-center rounded-t-[16px]"
                      style={{ height: c.ped, background: RANK_COLORS[c.rank], color: c.rank === 2 ? '#ffffff' : '#1e1e1e' }}
                    >
                      <span className="font-[family-name:var(--font-brand)] font-bold leading-none" style={{ fontSize: Math.max(24, c.ped * 0.55) }}>{c.rank + 1}</span>
                    </div>
                    <p className="mt-2 text-center font-[family-name:var(--font-brand)] font-semibold uppercase leading-tight" style={{ fontSize: Math.max(14, Math.min(30, c.w / 18)) }}>
                      Nr. {c.img.n} · {pts(c.img.id)} {pts(c.img.id) === 1 ? 'Punkt' : 'Punkte'}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <span className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full bg-black/40 px-5 py-1.5 text-[13px] font-semibold">
          {phase === 'gallery' ? (
            <>
              <span>Klick: +1 Punkt</span>
              <span>Umschalt oder Rechtsklick: −1</span>
              <span>Z rückgängig</span>
              <button type="button" className="underline underline-offset-2" onClick={resetVotes}>Punkte zurücksetzen</button>
              <span>Enter: Fertig</span>
            </>
          ) : phase === 'podium' ? (
            <>
              <span>← zurück zur Wertung</span>
              <span>F Vollbild</span>
            </>
          ) : (
            <>
              <span>← → blättern</span>
              <span>G Galerie</span>
              <span>A Automatik {auto ? 'an' : 'aus'}</span>
              <span>F Vollbild</span>
            </>
          )}
          <Link href="/admin/kuh" className="underline underline-offset-2">Esc oder hier beenden</Link>
        </span>
      </div>
    </div>
  )
}
