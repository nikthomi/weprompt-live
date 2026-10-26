import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StatusTag } from '@/components/StatusTag'
import { PresentationWindowButton } from '@/components/PresentationWindowButton'
import { LiveControlLauncher } from '@/components/LiveControlLauncher'
import { requireAdmin } from '@/lib/auth'
import { joinUrl, presentUrl, shortJoinUrl } from '@/lib/app-url'
import type { Question, Session } from '@/lib/types'
import { QuestionList } from './QuestionList'
import { SessionDetails } from './SessionDetails'
import { JoinPanel } from './JoinPanel'
import { DangerZone } from './DangerZone'

export const metadata: Metadata = { title: 'Session bearbeiten' }

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, admin } = await requireAdmin()
  const [{ data: session }, { data: questions }, { data: counts }] = await Promise.all([
    supabase.from('live_sessions').select('*').eq('id', id).maybeSingle<Session>(),
    supabase.from('live_questions').select('*').eq('session_id', id).order('position'),
    supabase.from('live_responses').select('question_id').eq('session_id', id),
  ])
  if (!session) notFound()
  const responseCounts: Record<string, number> = {}
  for (const r of counts ?? []) responseCounts[r.question_id] = (responseCounts[r.question_id] ?? 0) + 1

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="t-small underline underline-offset-4">← Alle Sessions</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="t-h1 [overflow-wrap:anywhere]">{session.title}</h1>
            <StatusTag status={session.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <PresentationWindowButton url={presentUrl(session.present_token)} />
            <Link href={`/admin/sessions/${id}/ergebnisse`} className="wp-btn-quiet">Ergebnisse</Link>
            {session.status !== 'archived' ? <LiveControlLauncher href={`/admin/sessions/${id}/live`} presentationUrl={presentUrl(session.present_token)} className="wp-btn wp-btn-primary" /> : null}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <QuestionList sessionId={id} questions={(questions ?? []) as Question[]} responseCounts={responseCounts} currentId={session.status === 'live' ? session.current_question_id : null} />
        <aside className="flex flex-col gap-6">
          <JoinPanel code={session.code} url={joinUrl(session.code)} label={shortJoinUrl(session.code)} title={session.title} />
          <SessionDetails session={session} />
          <DangerZone id={id} status={session.status} canDelete={admin.role === 'admin'} />
        </aside>
      </div>
    </div>
  )
}
