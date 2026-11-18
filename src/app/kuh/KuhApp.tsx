'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from '@/components/ui'

type Img = { id: string; n: number; url: string }
type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text: string }

const MAX_SIDE = 2000
const POLL_MS = 6000

/** Bild verkleinern (max. 2000 px), als JPEG: bleibt klein genug für den Upload und lädt schnell. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('shrink'))), 'image/jpeg', 0.86))
}

async function uploadOne(file: File): Promise<{ ok: true } | { ok: false; message: string }> {
  let blob: Blob = file
  try {
    blob = await shrink(file)
  } catch {
    // Format, den der Browser nicht zeichnen kann: nur das Original schicken, wenn es klein genug ist.
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 4_400_000) {
      return { ok: false, message: 'Dieses Bild konnte nicht verarbeitet werden. Bitte ein JPG oder PNG wählen.' }
    }
  }
  const body = new FormData()
  body.append('file', blob, 'bild.jpg')
  try {
    const res = await fetch('/api/kuh', { method: 'POST', body })
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => null)) as { message?: string } | null
    return { ok: false, message: data?.message ?? 'Hochladen fehlgeschlagen. Bitte nochmals versuchen.' }
  } catch {
    return { ok: false, message: 'Keine Verbindung. Bitte nochmals versuchen.' }
  }
}

export function KuhApp() {
  const [images, setImages] = useState<Img[]>([])
  const [mine, setMine] = useState<{ id: string; n: number | null } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' })
  const [dragging, setDragging] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kuh', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { images: Img[]; mine?: { id: string; n: number | null } | null }
      setImages([...data.images].reverse()) // neueste zuerst
      setMine(data.mine ?? null)
      setLoaded(true)
    } catch {
      // Beim nächsten Durchlauf nochmals versuchen.
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void load(), 0)
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [load])

  async function handleFiles(list: FileList | File[] | null) {
    if (mine) {
      setStatus({ kind: 'error', text: 'Du hast schon ein Bild hochgeladen. Pro Person ist eines möglich.' })
      return
    }
    const file = Array.from(list ?? []).find(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name))
    if (!file) {
      setStatus({ kind: 'error', text: 'Bitte ein Bild auswählen (JPG, PNG oder WebP).' })
      return
    }
    setStatus({ kind: 'busy', text: 'Bild wird hochgeladen …' })
    const r = await uploadOne(file)
    await load()
    if (!r.ok) {
      setStatus({ kind: 'error', text: r.message })
      return
    }
    setStatus({ kind: 'ok', text: 'Geschafft! Dein Bild ist in der Galerie.' })
  }

  const current = open ? images.findIndex(i => i.id === open) : -1
  const step = useCallback(
    (d: number) => {
      setOpen(id => {
        const i = images.findIndex(x => x.id === id)
        if (i < 0 || images.length === 0) return id
        return images[(i + d + images.length) % images.length].id
      })
    },
    [images],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step])

  const shown = current >= 0 ? images[current] : null

  return (
    <div className="on-violett min-h-dvh pb-20">
      <TopBar>
        <span className="wp-tag compact live">Kreativ-Challenge</span>
      </TopBar>

      <main className="mx-auto max-w-[1312px] px-4 pt-8 md:px-10 md:pt-14">
        <header className="max-w-[900px]">
          <p className="t-caption text-amber">Kreativ-Challenge</p>
          <h1 className="t-h1 mt-2 text-white md:text-[64px] md:leading-[66px]">Die Kuh muss auf die Alp!</h1>
          <p className="t-lead mt-4 text-white">Lade hier dein Ergebnis hoch. Alle Bilder erscheinen sofort in der Galerie.</p>
        </header>

        <section className="mt-8 md:mt-10" aria-label="Bild hochladen">
          {mine ? (
            <div className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-mist px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
              <span className="wp-tag compact shrink-0 self-start !bg-amber font-bold sm:self-auto">{mine.n ? `Nr. ${mine.n}` : 'Dein Bild'}</span>
              <p className="t-lead flex-1 text-black">Dein Bild ist in der Galerie. Pro Person ist ein Bild möglich.</p>
            </div>
          ) : (
          <div
            onDragOver={e => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              void handleFiles(e.dataTransfer.files)
            }}
            className={`rounded-[var(--radius-card)] p-2 transition-colors ${dragging ? 'bg-amber' : 'bg-mist'}`}
          >
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={status.kind === 'busy'}
              className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-[14px] border-[3px] border-dashed border-violett px-5 py-4 text-center disabled:cursor-default sm:flex-row sm:gap-5 sm:text-left"
            >
              <svg className="shrink-0" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6b11fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 16V4M12 4l-5 5M12 4l5 5" />
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
              <span className="t-lead flex-1 text-black">Bild hierher ziehen oder tippen</span>
              <span className="wp-btn wp-btn-primary">{status.kind === 'busy' ? 'Wird hochgeladen …' : 'Bild auswählen'}</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={e => {
                void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
          )}
          <p role="status" aria-live="polite" className={`t-lead mt-4 min-h-[30px] ${status.kind === 'error' ? 'text-amber' : 'text-white'}`}>
            {status.text}
          </p>
        </section>

        <section className="mt-10 md:mt-14" aria-label="Galerie">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <h2 className="t-h2 text-white">Galerie</h2>
            {loaded ? <span className="wp-tag on-dark">{images.length} {images.length === 1 ? 'Bild' : 'Bilder'}</span> : null}
          </div>

          {loaded && images.length === 0 ? (
            <p className="t-lead text-white">Noch kein Bild da. Sei die erste Person!</p>
          ) : (
            <ul className="columns-1 gap-5 min-[700px]:columns-2 min-[1500px]:columns-3">
              {images.map(img => (
                <li key={img.id} className="mb-4 break-inside-avoid">
                  <button
                    type="button"
                    onClick={() => setOpen(img.id)}
                    className="group relative block w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-card)] bg-mist"
                    aria-label={`Bild Nr. ${img.n} gross ansehen`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`Bild Nr. ${img.n}`} loading="lazy" decoding="async" className="block h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]" />
                    <span className="wp-tag compact absolute left-3 top-3 !bg-amber font-bold">Nr. {img.n}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {shown ? (
        <div role="dialog" aria-modal="true" aria-label={`Bild Nr. ${shown.n}`} className="on-violett fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.url} alt={`Bild Nr. ${shown.n}`} className="max-h-[88dvh] max-w-[94vw] rounded-[var(--radius-card)] object-contain" onClick={e => e.stopPropagation()} />
          <span className="wp-tag absolute left-5 top-5 !border-0 !bg-amber font-bold">Nr. {shown.n}</span>
          <button type="button" className="wp-btn-quiet on-dark absolute right-5 top-5" onClick={() => setOpen(null)}>
            Schliessen
          </button>
          {images.length > 1 ? (
            <>
              <button type="button" aria-label="Vorheriges Bild" className="wp-arrow absolute left-3 top-1/2 -translate-y-1/2 md:left-6" onClick={e => { e.stopPropagation(); step(-1) }}>
                <span aria-hidden className="text-[26px] leading-none">‹</span>
              </button>
              <button type="button" aria-label="Nächstes Bild" className="wp-arrow absolute right-3 top-1/2 -translate-y-1/2 md:right-6" onClick={e => { e.stopPropagation(); step(1) }}>
                <span aria-hidden className="text-[26px] leading-none">›</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
