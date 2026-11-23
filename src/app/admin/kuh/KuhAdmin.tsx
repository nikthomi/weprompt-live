'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { clearKuhGallery, deleteKuhImage } from './actions'
import { useKuhImages } from './useKuhImages'

export function KuhAdmin({ canClear }: { canClear: boolean }) {
  const { images, setImages, loaded, reload } = useKuhImages(5000)
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function remove(id: string, n: number) {
    if (!confirm(`Bild Nr. ${n} endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return
    setMessage(null)
    start(async () => {
      const r = await deleteKuhImage(id)
      if (r.error) setMessage(r.error)
      else setImages(list => list.filter(i => i.id !== id))
    })
  }

  function clearAll() {
    if (!confirm(`Alle ${images.length} Bilder endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return
    setMessage(null)
    start(async () => {
      const r = await clearKuhGallery()
      if (r.error) setMessage(r.error)
      else {
        setImages([])
        setMessage(`${r.removed ?? 0} Bilder gelöscht.`)
        void reload()
      }
    })
  }

  const shown = [...images].reverse() // neueste zuerst

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h1">Kreativ-Challenge</h1>
          <p className="t-small mt-2 text-gray">
            {loaded ? `${images.length} ${images.length === 1 ? 'Bild' : 'Bilder'}` : 'Lädt …'} · Upload unter{' '}
            <a href="https://kuh.weprompt.ch" target="_blank" rel="noreferrer" className="font-semibold text-black underline underline-offset-4">kuh.weprompt.ch</a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canClear && images.length > 0 ? (
            <button type="button" className="wp-btn-quiet" disabled={pending} onClick={clearAll}>Galerie leeren</button>
          ) : null}
          <Link href="/admin/kuh/praesentation" className={`wp-btn wp-btn-primary ${images.length === 0 ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={images.length === 0}>
            Präsentation starten
          </Link>
        </div>
      </div>

      <p className="t-body max-w-[760px] rounded-[var(--radius-card)] bg-white px-6 py-4">
        <b>So läuft die Präsentation:</b> Jedes Bild einzeln, dann alle zusammen in einer Galerie ohne Scrollen. Mit den Pfeiltasten oder einem Klick weiterschalten, <kbd>G</kbd> springt zur Galerie, <kbd>F</kbd> schaltet Vollbild ein, <kbd>A</kbd> startet den Automatikmodus, <kbd>Esc</kbd> beendet.<br /><b>Wertung:</b> In der Galerie gibt ein Klick auf ein Bild einen Punkt (Umschalt oder Rechtsklick nimmt einen weg, <kbd>Z</kbd> macht den letzten rückgängig). Während der Punktevergabe bleiben alle Bilder an ihrem Platz. Mit «Fertig» (oder Enter) ordnen sie sich nach der Rangliste, ein weiteres Enter zeigt die drei Siegerbilder gerahmt auf dem Podest.</p>

      <div role="status" aria-live="polite" className="t-body min-h-6 text-coral">{message}</div>

      {loaded && images.length === 0 ? (
        <p className="t-body rounded-[var(--radius-card)] bg-white px-6 py-8">Noch keine Bilder. Sie erscheinen hier, sobald jemand eines hochlädt.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4">
          {shown.map(img => (
            <li key={img.id} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`Bild Nr. ${img.n}`} loading="lazy" decoding="async" className="block aspect-[4/3] w-full bg-black/5 object-contain" />
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="wp-tag compact shrink-0 !bg-amber font-bold">Nr. {img.n}</span>
                  <span className="truncate text-[15px] font-semibold">{img.name ?? 'ohne Namen'}</span>
                </span>
                <button type="button" className="font-[family-name:var(--font-brand)] text-[15px] font-semibold text-coral hover:underline disabled:opacity-50" disabled={pending} onClick={() => remove(img.id, img.n)}>
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
