import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { CODE_RE, UUID_RE, json } from '@/lib/public-api'

/** Zustand einer Session für Teilnehmende. ?pid= meldet das Gerät an und sagt, ob schon beantwortet. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase()
  const pid = req.nextUrl.searchParams.get('pid')
  if (!CODE_RE.test(code)) return json({ error: 'not_found' }, 404)
  const { data, error } = await createAdminClient().rpc('live_join', { p_code: code, p_participant_id: pid && UUID_RE.test(pid) ? pid : null })
  if (error) return json({ error: 'server' }, 500)
  if (!data) return json({ error: 'not_found' }, 404)
  return json(data)
}
