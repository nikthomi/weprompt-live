'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

const BUCKET = 'live-images'
const MAX_SIDE = 1600

/** Bild verkleinern (max. 1600 px), als JPEG – hält Beamer und Handys schnell. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden.'))), 'image/jpeg', 0.86))
}

const pathOf = (url: string) => url.split(`/storage/v1/object/public/${BUCKET}/`)[1]

export function QuizImage({ questionId, url, onChange }: { questionId: string; url?: string; onChange: (url: string | undefined) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return setError('Bitte ein Bild im Format JPG, PNG oder WebP wählen.')
    if (file.size > 25 * 1024 * 1024) return setError('Das Bild ist zu gross (max. 25 MB).')
    setBusy(true)
    try {
      const supabase = createClient()
      const blob = await shrink(file)
      const path = `${questionId}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (error) throw error
      const old = url && pathOf(url)
      if (old) await supabase.storage.from(BUCKET).remove([old])
      onChange(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)
    } catch {
      setError('Hochladen fehlgeschlagen. Versuche es nochmals.')
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    const old = url && pathOf(url)
    if (old) await createClient().storage.from(BUCKET).remove([old])
    onChange(undefined)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="wp-label">Bild (freiwillig)</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="max-h-56 w-fit max-w-full rounded-[14px] object-contain" />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label className="wp-btn-quiet cursor-pointer">
          {busy ? 'Wird hochgeladen …' : url ? 'Bild ersetzen' : 'Bild hochladen'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
        </label>
        {url && !busy ? <button type="button" className="wp-btn-quiet" onClick={clear}>Bild entfernen</button> : null}
      </div>
      <p className="wp-hint">Erscheint auf dem Beamer und auf den Handys. Wird auf höchstens 1600 Pixel verkleinert.</p>
      {error ? <p role="alert" className="wp-hint !text-black">{error}</p> : null}
    </div>
  )
}
