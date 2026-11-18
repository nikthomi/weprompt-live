import type { NextRequest, NextResponse } from 'next/server'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { clientKey, json } from '@/lib/public-api'

/**
 * Kreativ-Challenge «Die Kuh muss auf die Alp!» (kuh.weprompt.ch).
 * Ohne Login: jede Person darf EIN Bild hochladen, alle Bilder erscheinen in der Galerie.
 * «Eine Person» heisst hier: ein Browser. Beim Hochladen setzt der Server ein Cookie mit dem
 * Dateinamen. Solange diese Datei noch existiert, wird ein zweiter Upload abgelehnt. Löscht die
 * Moderation das Bild oder die Person selbst (DELETE), darf sie erneut hochladen. Das ist eine Spielregel, kein
 * Sicherheitsmerkmal: Mit einem privaten Fenster oder einem zweiten Gerät lässt sie sich umgehen.
 * Der Rest des Schutzes: Dateityp am Inhalt, Grösse, Gesamtzahl, Rate Limit pro Netz.
 */
const BUCKET = 'kuh'
const MAX_BYTES = 4_500_000 // Vercel erlaubt höchstens 4,5 MB pro Anfrage
const MAX_IMAGES = 300
const COOKIE = 'kuh_bild'
const NAME_RE = /^[a-z0-9-]{4,60}\.(jpg|png|webp)$/

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

/**
 * Das Cookie enthält «Dateiname.Signatur». Ohne Signatur könnte jede Person einen fremden
 * Dateinamen (steht in den öffentlichen Bild-Adressen) ins Cookie schreiben und so fremde
 * Bilder löschen. Der Schlüssel liegt nur auf dem Server.
 */
function sign(name: string) {
  const secret = process.env.RATE_LIMIT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'weprompt-kuh'
  return createHmac('sha256', secret).update(`kuh:${name}`).digest('base64url').slice(0, 24)
}

function cookieValue(name: string) {
  return `${name}.${sign(name)}`
}

function ownName(req: NextRequest, existing: string[]) {
  const v = req.cookies.get(COOKIE)?.value
  if (!v) return null
  const i = v.lastIndexOf('.')
  // Dateiname enthält selbst einen Punkt (.jpg), die Signatur steht nach dem letzten Punkt.
  const name = v.slice(0, i)
  const sig = v.slice(i + 1)
  if (!NAME_RE.test(name)) return null
  const expected = sign(name)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  return existing.includes(name) ? name : null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const files = await listAll()
    const images = files.map((f, i) => ({
      id: f.name,
      n: i + 1,
      url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
    }))
    const mine = ownName(req, files.map(f => f.name))
    return json({ images, mine: mine ? { id: mine, n: images.find(i => i.id === mine)?.n ?? null } : null })
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
    const existing = await listAll()
    if (ownName(req, existing.map(f => f.name))) {
      return json({ error: 'already', message: 'Du hast schon ein Bild hochgeladen. Pro Person ist eines möglich.' }, 409)
    }
    if (existing.length >= MAX_IMAGES) return json({ error: 'full', message: 'Die Galerie ist voll.' }, 409)
    const name = `${Date.now().toString(36)}-${randomBytes(5).toString('hex')}.${kind.ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(name, bytes, { contentType: kind.type, cacheControl: '31536000', upsert: false })
    if (error) throw error
    const res = json({ ok: true, id: name }) as NextResponse
    res.cookies.set(COOKIE, cookieValue(name), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 })
    return res
  } catch (e) {
    console.error('kuh: Upload fehlgeschlagen', e)
    return json({ error: 'server', message: 'Hochladen fehlgeschlagen. Bitte nochmals versuchen.' }, 500)
  }
}

/** Jede Person darf nur ihr eigenes Bild löschen (das, dessen Dateiname im Cookie steht). */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const files = await listAll()
    const mine = ownName(req, files.map(f => f.name))
    if (!mine) return json({ error: 'none', message: 'Du hast kein Bild in der Galerie.' }, 404)
    const { error } = await supabase.storage.from(BUCKET).remove([mine])
    if (error) throw error
    const res = json({ ok: true }) as NextResponse
    res.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
    return res
  } catch (e) {
    console.error('kuh: Löschen fehlgeschlagen', e)
    return json({ error: 'server', message: 'Löschen fehlgeschlagen. Bitte nochmals versuchen.' }, 500)
  }
}
