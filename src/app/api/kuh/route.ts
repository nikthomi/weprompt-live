import type { NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { clientKey, json } from '@/lib/public-api'

/**
 * Kreativ-Challenge «Die Kuh muss auf die Alp!» (kuh.weprompt.ch).
 * Ohne Login: jede Person darf ein Bild hochladen, alle Bilder erscheinen in der Galerie.
 * Der Schutz liegt hier: Dateityp wird am Inhalt geprüft, Grösse und Gesamtzahl sind
 * begrenzt, pro Netz gibt es ein Rate Limit. Bilder liegen im öffentlichen Bucket «kuh».
 */
const BUCKET = 'kuh'
const MAX_BYTES = 4_500_000 // Vercel erlaubt höchstens 4,5 MB pro Anfrage
const MAX_IMAGES = 300

function sniff(b: Uint8Array): { type: string; ext: string } | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' }
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: 'image/png', ext: 'png' }
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { type: 'image/webp', ext: 'webp' }
  return null
}

async function listAll() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } })
  if (error) throw error
  return (data ?? []).filter(f => f.name && !f.name.startsWith('.') && f.id)
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const files = await listAll()
    const images = files.map((f, i) => ({
      id: f.name,
      n: i + 1,
      url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
    }))
    return json({ images })
  } catch (e) {
    console.error('kuh: Liste fehlgeschlagen', e)
    return json({ error: 'server', message: 'Die Galerie konnte nicht geladen werden.' }, 500)
  }
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES + 20_000) return json({ error: 'too_big', message: 'Das Bild ist zu gross.' }, 413)

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    file = f instanceof File ? f : null
  } catch {
    return json({ error: 'invalid', message: 'Das hat nicht geklappt. Bitte nochmals versuchen.' }, 400)
  }
  if (!file || file.size === 0) return json({ error: 'invalid', message: 'Bitte wähle ein Bild aus.' }, 400)
  if (file.size > MAX_BYTES) return json({ error: 'too_big', message: 'Das Bild ist zu gross.' }, 413)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = sniff(bytes)
  if (!kind) return json({ error: 'type', message: 'Bitte ein Bild im Format JPG, PNG oder WebP wählen.' }, 415)

  const supabase = createAdminClient()

  const key = clientKey(req)
  if (key) {
    const { data: ok } = await supabase.rpc('live_rate_hit', { p_key: `kuh:${key}`, p_limit: 15, p_window_seconds: 600 })
    if (ok === false) return json({ error: 'rate_limited', message: 'Zu viele Bilder in kurzer Zeit. Warte einen Moment.' }, 429)
  }

  try {
    if ((await listAll()).length >= MAX_IMAGES) return json({ error: 'full', message: 'Die Galerie ist voll.' }, 409)
    const name = `${Date.now().toString(36)}-${randomBytes(5).toString('hex')}.${kind.ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(name, bytes, { contentType: kind.type, cacheControl: '31536000', upsert: false })
    if (error) throw error
    return json({ ok: true, id: name })
  } catch (e) {
    console.error('kuh: Upload fehlgeschlagen', e)
    return json({ error: 'server', message: 'Hochladen fehlgeschlagen. Bitte nochmals versuchen.' }, 500)
  }
}
