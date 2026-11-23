import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { clientKey, json } from '@/lib/public-api'

// Name und Avatar für das Quiz. Die genaue Prüfung macht live_set_profile.
const Body = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{6}$/),
  participantId: z.uuid(),
  name: z.string().min(1).max(60),
  avatar: z.string().max(20),
  website: z.string().max(0).optional(),
}).strict()

const MESSAGES: Record<string, [number, string]> = {
  rate_limited: [429, 'Zu viele Versuche. Warte einen Moment und versuche es nochmals.'],
  not_found: [404, 'Diese Session gibt es nicht mehr.'],
  invalid: [400, 'Gib einen Namen mit höchstens 20 Zeichen ein und wähle einen Avatar.'],
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? 0) > 2_000) return json({ error: 'invalid', message: MESSAGES.invalid[1] }, 413)
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return json({ error: 'invalid', message: MESSAGES.invalid[1] }, 400)
  }
  const { data, error } = await createAdminClient().rpc('live_set_profile', {
    p_code: body.code.toUpperCase(),
    p_participant_id: body.participantId,
    p_name: body.name,
    p_avatar: body.avatar,
    p_client_key: clientKey(req),
  })
  if (error) console.error('live: live_set_profile fehlgeschlagen', error.code, error.message)
  if (error || !data) return json({ error: 'server', message: 'Das hat nicht geklappt. Bitte nochmals versuchen.' }, 500)
  const r = data as { ok: boolean; error?: string; name?: string; avatar?: string }
  if (r.ok) return json({ ok: true, name: r.name, avatar: r.avatar })
  const [status, message] = MESSAGES[r.error ?? ''] ?? MESSAGES.invalid
  return json({ error: r.error, message }, status)
}
