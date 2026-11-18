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

type Phase = 'single' | 'gallery' | 'ranked' | 'podium'
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
  // Während der Punktevergabe bleiben die Bilder an ihrem Platz (nach Nummer). Erst die Rangliste ordnet neu.
  const ordered: KuhImg[] = phase === 'ranked' ? ranked : images
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
    if (phase === 'ranked') setPhase('podium')
    else if (phase === 'single') {
      if (safeIndex >= count - 1) setPhase('gallery')
      else setIndex(safeIndex + 1)
    }
  }, [phase, safeIndex, count])

  const prev = useCallback(() => {
    if (phase === 'podium') setPhase('ranked')
    else if (phase === 'ranked') setPhase('gallery')
    else if (phase === 'gallery') {
      setPhase('single')
      setIndex(Math.max(0, count - 1))
    } else setIndex(Math.max(0, safeIndex - 1))
  }, [phase, safeIndex, count])

  // «Fertig»: erst jetzt ordnen sich die Bilder nach der Rangliste. Nochmals Enter zeigt das Podest.
  const toFinish = useCallback(() => {
    if (phase === 'gallery' && total > 0) setPhase('ranked')
    else if (phase === 'ranked') setPhase('podium')
  }, [phase, total])

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
      else if (e.key === 'Enter' && (phase === 'gallery' || phase === 'ranked')) toFinish()
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

  // Stufen nach Punktzahl: Bilder mit gleich vielen Punkten teilen sich dieselbe Stufe (gleiches Podest).
  const tiers: { pts: number; imgs: KuhImg[] }[] = []
  for (const img of ranked) {
    const p = pts(img.id)
    if (p <= 0) break
    const last = tiers[tiers.length - 1]
    if (last && last.pts === p) last.imgs.push(img)
    else tiers.push({ pts: p, imgs: [img] })
  }
  const tierOf = (id: string) => tiers.findIndex(t => t.imgs.some(i => i.id === id))

  // Podest: Breiten aus dem verfügbaren Bereich, Höhen so, dass alles ohne Scrollen passt.
  const P_GAP = 28
  const TILE_GAP = 14
  const CAP = 5 // mehr Bilder pro Stufe würden zu klein
  const WEIGHT = [1.35, 1, 1] // Mitte (Platz 1) etwas grösser als die Seiten
  const top = tiers.slice(0, 3).map((t, k) => ({ ...t, k, shown: t.imgs.slice(0, CAP), more: Math.max(0, t.imgs.length - CAP) }))
  const weightSum = top.reduce((sum, t) => sum + t.shown.length * WEIGHT[t.k], 0)
  const gapSum = top.reduce((sum, t) => sum + (t.shown.length - 1) * TILE_GAP, 0) + Math.max(0, top.length - 1) * P_GAP
  const u = Math.max(0, Math.min((area.w - gapSum) / (weightSum || 1), (0.56 * area.h) / (0.75 * 1.35)))
  const rem = area.h - 0.75 * 1.35 * u - 96
  const p1 = Math.max(0.08 * area.h, Math.min(0.3 * area.h, rem * 0.85))
  const PED = [p1, p1 * 0.66, p1 * 0.42]
  const columns = [1, 0, 2].map(k => top.find(t => t.k === k)).filter((t): t is (typeof top)[number] => Boolean(t))

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
      ) : phase === 'gallery' || phase === 'ranked' ? (
        <>
          <header className="flex items-center justify-between gap-4 px-6 pb-3 pt-5 md:px-10">
            <h1 className="font-[family-name:var(--font-brand)] text-[clamp(22px,2.6vw,40px)] font-semibold leading-none">Die Kuh muss auf die Alp!</h1>
            <div className="flex items-center gap-3">
              <span className="rounded-full border-2 border-white px-5 py-1 font-[family-name:var(--font-brand)] text-[clamp(14px,1.5vw,24px)] font-semibold uppercase">
                {total} {total === 1 ? 'Punkt' : 'Punkte'}
              </span>
              <button type="button" className="wp-btn wp-btn-primary" disabled={phase === 'gallery' && total === 0} onClick={toFinish}>
                {phase === 'ranked' ? 'Podest zeigen' : 'Fertig'}
              </button>
            </div>
          </header>
          <div ref={areaRef} className="min-h-0 flex-1 px-6 pb-14 md:px-10">
            <div className="flex h-full w-full items-center justify-center">
              <ul className="relative" style={{ width: gridW, height: gridH }}>
                {ordered.map((img, i) => {
                  const p = pts(img.id)
                  const tier = phase === 'ranked' && p > 0 ? tierOf(img.id) : -1
                  const rank = tier >= 0 && tier < 3 ? tier : -1
                  return (
                    <li
                      key={img.id}
                      className="absolute left-0 top-0 transition-transform duration-500 ease-out"
                      style={{ width: grid.width, height: cellH, transform: `translate(${(i % grid.cols) * (grid.width + GAP)}px, ${Math.floor(i / grid.cols) * (cellH + GAP)}px)` }}
                    >
                      <button
                        type="button"
                        aria-label={`Bild Nr. ${img.n}, ${p} ${p === 1 ? 'Punkt' : 'Punkte'}.${phase === 'gallery' ? ' Klick gibt einen Punkt, Umschalt plus Klick nimmt einen weg.' : ''}`}
                        className={`relative block h-full w-full overflow-hidden rounded-[14px] bg-mist ${phase === 'gallery' ? 'cursor-pointer' : 'cursor-default'}`}
                        style={rank >= 0 ? { outline: `${Math.max(4, grid.width / 60)}px solid ${RANK_COLORS[rank]}`, outlineOffset: 2 } : undefined}
                        onClick={e => { if (phase === 'gallery') vote(img.id, e.shiftKey ? -1 : 1) }}
                        onContextMenu={e => { e.preventDefault(); if (phase === 'gallery') vote(img.id, -1) }}
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
              {columns.map(c => {
                const tw = WEIGHT[c.k] * u
                const colW = c.shown.length * tw + (c.shown.length - 1) * TILE_GAP
                const color = RANK_COLORS[c.k]
                const label = c.shown.map(i => `Nr. ${i.n}`).join(' und ') + (c.more ? ` und ${c.more} weitere` : '')
                return (
                  <div key={c.k} className="flex flex-col items-stretch" style={{ width: colW }}>
                    <div className="flex items-end justify-center" style={{ gap: TILE_GAP }}>
                      {c.shown.map(img => (
                        <div
                          key={img.id}
                          className="relative shrink-0 overflow-hidden bg-mist"
                          style={{ width: tw, height: (tw * 3) / 4, border: `${Math.max(6, tw / 36)}px solid ${color}`, borderRadius: 22, boxShadow: '0 14px 44px rgba(0,0,0,.4)' }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={`Platz ${c.k + 1}: Bild Nr. ${img.n}`} className="block h-full w-full object-contain" />
                        </div>
                      ))}
                    </div>
                    <div
                      className="mt-3 flex flex-col items-center justify-center rounded-t-[16px]"
                      style={{ height: PED[c.k], background: color, color: c.k === 2 ? '#ffffff' : '#1e1e1e' }}
                    >
                      <span className="font-[family-name:var(--font-brand)] font-bold leading-none" style={{ fontSize: Math.max(24, PED[c.k] * 0.55) }}>{c.k + 1}</span>
                    </div>
                    <p className="mt-2 text-center font-[family-name:var(--font-brand)] font-semibold uppercase leading-tight" style={{ fontSize: Math.max(14, Math.min(30, WEIGHT[c.k] * u / 14)) }}>
                      {label} · {c.pts} {c.pts === 1 ? 'Punkt' : 'Punkte'}
                    </p>
                  </div>
                )
              })}
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
              <span>Enter: Fertig (Rangliste)</span>
            </>
          ) : phase === 'ranked' ? (
            <>
              <span>Enter oder →: Podest</span>
              <span>← zurück zur Punktevergabe</span>
            </>
          ) : phase === 'podium' ? (
            <>
              <span>← zurück zur Rangliste</span>
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
