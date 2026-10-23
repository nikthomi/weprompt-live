import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { joinUrl, presentUrl, shortJoinUrl } from '@/lib/app-url'
import type { Question, Session, Snapshot } from '@/lib/types'
import { LiveControl } from './LiveControl'

export const metadata: Metadata = { title: 'Live steuern' }

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const [{ data: session }, { data: questions }, { data: snap }] = await Promise.all([
    supabase.from('live_sessions').select('*').eq('id', id).maybeSingle<Session>(),
    supabase.from('live_questions').select('*').eq('session_id', id).eq('enabled', true).order('position'),
    supabase.rpc('live_admin_snapshot', { p_session_id: id }),
  ])
  if (!session || !snap) notFound()
  return (
    <LiveControl
      session={session}
      questions={(questions ?? []) as Question[]}
      initial={snap as Snapshot}
      joinUrl={joinUrl(session.code)}
      joinLabel={shortJoinUrl(session.code)}
      presentUrl={presentUrl(session.present_token)}
    />
  )
}
