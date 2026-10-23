import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { json } from '@/lib/public-api'

/** Daten für den Beamer: öffentlicher Zustand, Zahlen und (falls eingeblendet) Ergebnisse. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: 'not_found' }, 404)
  const { data, error } = await createAdminClient().rpc('live_present', { p_token: token })
  if (error) return json({ error: 'server' }, 500)
  if (!data) return json({ error: 'not_found' }, 404)
  return json(data)
}
