'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useKuhImages } from '../useKuhImages'

const GAP = 14
const CELL_ASPECT = 4 / 3
const AUTO_MS = 7000

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

type Phase = 'single' | 'gallery'

export function Praesentation() {
  const { images } = useKuhImages(6000)
  const [phase, setPhase] = useState<Phase>('single')
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(false)
  const [gridRef, gridSize] = useSize()
  const router = useRouter()

  const count = images.length
  const safeIndex = Math.min(index, Math.max(0, count - 1))
  const current = images[safeIndex]

  const next = useCallback(() => {
    if (phase === 'gallery') return
    if (safeIndex >= count - 1) setPhase('gallery')
    else setIndex(safeIndex + 1)
  }, [phase, safeIndex, count])

  const prev = useCallback(() => {
    if (phase === 'gallery') {
      setPhase('single')
      setIndex(Math.max(0, count - 1))
    } else setIndex(Math.max(0, safeIndex - 1))
  }, [phase, safeIndex, count])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev() }
      else if (e.key === 'g' || e.key === 'G') setPhase(p => (p === 'gallery' ? 'single' : 'gallery'))
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      else if (e.key === 'a' || e.key === 'A') setAuto(a => !a)
      else if (e.key === 'Home') { setPhase('single'); setIndex(0) }
      else if (e.key === 'Escape') router.push('/admin/kuh')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, toggleFullscreen, router])

  // Automatikmodus: alle paar Sekunden weiter, am Ende bleibt die Galerie stehen.
  useEffect(() => {
    if (!auto || phase === 'gallery') return
    const t = setTimeout(next, AUTO_MS)
    return () => clearTimeout(t)
  }, [auto, phase, next, safeIndex])

  const grid = bestGrid(count, gridSize.w, gridSize.h)
  const cellH = Math.floor(grid.width / CELL_ASPECT)

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
      ) : (
        <>
          <header className="flex items-center justify-between gap-4 px-6 pb-3 pt-5 md:px-10">
            <h1 className="font-[family-name:var(--font-brand)] text-[clamp(22px,2.6vw,40px)] font-semibold leading-none">Die Kuh muss auf die Alp!</h1>
            <span className="rounded-full border-2 border-white px-5 py-1 font-[family-name:var(--font-brand)] text-[clamp(14px,1.5vw,24px)] font-semibold uppercase">{count} {count === 1 ? 'Bild' : 'Bilder'}</span>
          </header>
          <div ref={gridRef} className="min-h-0 flex-1 px-6 pb-14 md:px-10">
            <div className="flex h-full w-full items-center justify-center">
              <ul className="grid content-center justify-center" style={{ gridTemplateColumns: `repeat(${grid.cols}, ${grid.width}px)`, gap: GAP }}>
                {images.map(img => (
                  <li key={img.id} className="relative overflow-hidden rounded-[14px] bg-mist" style={{ width: grid.width, height: cellH }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`Bild Nr. ${img.n}`} className="block h-full w-full object-contain" />
                    <span className="absolute left-2 top-2 rounded-full bg-amber px-3 py-0.5 font-[family-name:var(--font-brand)] font-bold uppercase leading-5 text-black" style={{ fontSize: Math.max(11, Math.min(22, grid.width / 12)) }}>Nr. {img.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <span className="pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1 rounded-full bg-black/40 px-5 py-1.5 text-[13px] font-semibold">
          <span>← → blättern</span>
          <span>G {phase === 'gallery' ? 'Einzelbilder' : 'Galerie'}</span>
          <span>F Vollbild</span>
          <span>A Automatik {auto ? 'an' : 'aus'}</span>
          <Link href="/admin/kuh" className="underline underline-offset-2">Esc oder hier beenden</Link>
        </span>
      </div>
    </div>
  )
}
