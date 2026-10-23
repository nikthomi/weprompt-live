import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { clientKey, json } from '@/lib/public-api'

// Grobe Form hier, die genaue Prüfung gegen die Frage macht live_submit in der Datenbank.
const Body = z.object({
  questionId: z.uuid(),
  participantId: z.uuid(),
  value: z.union([
    z.object({ options: z.array(z.string().max(40)).min(1).max(20) }).strict(),
    z.object({ value: z.number().int().min(0).max(100) }).strict(),
    z.object({ words: z.array(z.string().max(200)).min(1).max(10) }).strict(),
    z.object({ text: z.string().max(2000) }).strict(),
  ]),
  // Honeypot: Menschen füllen das unsichtbare Feld nie aus.
  website: z.string().max(0).optional(),
}).strict()

const MESSAGES: Record<string, [number, string]> = {
  rate_limited: [429, 'Zu viele Versuche. Warte einen Moment und versuche es nochmals.'],
  closed: [409, 'Die Abstimmung zu dieser Frage ist geschlossen.'],
  not_found: [404, 'Diese Frage gibt es nicht mehr.'],
  invalid: [400, 'Diese Antwort ist nicht gültig.'],
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? 0) > 8_000) return json({ error: 'invalid', message: MESSAGES.invalid[1] }, 413)
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return json({ error: 'invalid', message: MESSAGES.invalid[1] }, 400)
  }

  const { data, error } = await createAdminClient().rpc('live_submit', {
    p_question_id: body.questionId,
    p_participant_id: body.participantId,
    p_value: body.value,
    p_client_key: clientKey(req),
  })
  if (error || !data) return json({ error: 'server', message: 'Das hat nicht geklappt. Bitte nochmals senden.' }, 500)
  const r = data as { ok: boolean; duplicate?: boolean; error?: string }
  if (r.ok) return json({ ok: true, duplicate: Boolean(r.duplicate) })
  const [status, message] = MESSAGES[r.error ?? ''] ?? [400, MESSAGES.invalid[1]]
  return json({ error: r.error, message }, status)
}
