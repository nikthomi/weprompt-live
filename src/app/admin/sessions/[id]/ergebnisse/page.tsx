import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import type { Question, Results, Session } from '@/lib/types'
import { ResultCard } from './ResultCard'

export const metadata: Metadata = { title: 'Ergebnisse' }

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const [{ data: session }, { data: questions }, { data: results }, { count: participants }] = await Promise.all([
    supabase.from('live_sessions').select('*').eq('id', id).maybeSingle<Session>(),
    supabase.from('live_questions').select('*').eq('session_id', id).order('position'),
    supabase.rpc('live_admin_results', { p_session_id: id }),
    supabase.from('live_participants').select('participant_id', { count: 'exact', head: true }).eq('session_id', id),
  ])
  if (!session) notFound()
  const byId = new Map(((results ?? []) as { questionId: string; results: Results }[]).map(r => [r.questionId, r.results]))
  const date = session.event_date ?? session.started_at ?? session.created_at

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/admin/sessions/${id}`} className="t-small underline underline-offset-4">← Zur Session</Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="t-h1 [overflow-wrap:anywhere]">Ergebnisse</h1>
            <p className="t-body mt-2">{session.title} · {formatDate(date)} · {participants ?? 0} {participants === 1 ? 'Person' : 'Personen'} beigetreten</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/sessions/${id}/export/antworten`} className="wp-btn-quiet" download>CSV: alle Antworten</a>
            <a href={`/admin/sessions/${id}/export/auswertung`} className="wp-btn-quiet" download>CSV: Auswertung</a>
          </div>
        </div>
      </div>
      {(questions ?? []).length === 0 ? <p className="t-body rounded-[var(--radius-card)] bg-white px-6 py-8">Diese Session hat keine Fragen.</p> : null}
      <ol className="flex flex-col gap-6">
        {((questions ?? []) as Question[]).map((q, i) => (
          <li key={q.id}>
            <ResultCard question={q} number={i + 1} results={byId.get(q.id) ?? null} sessionTitle={session.title} />
          </li>
        ))}
      </ol>
    </div>
  )
}
