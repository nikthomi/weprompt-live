import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { StatusTag } from '@/components/StatusTag'
import type { Session } from '@/lib/types'
import { NewSessionForm } from './NewSessionForm'
import { SessionMenu } from './SessionMenu'

export const metadata: Metadata = { title: 'Sessions' }

type Row = Pick<Session, 'id' | 'title' | 'code' | 'status' | 'event_date' | 'created_at'> & { live_questions: { id: string }[] }

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ archiv?: string }> }) {
  const archive = (await searchParams).archiv === '1'
  const { supabase } = await requireAdmin()
  let query = supabase.from('live_sessions').select('id, title, code, status, event_date, created_at, live_questions!live_questions_session_id_fkey(id)')
  query = archive ? query.eq('status', 'archived') : query.neq('status', 'archived')
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
  if (error) throw new Error(`Sessions konnten nicht geladen werden: ${error.message}`)
  const sessions = (data ?? []) as Row[]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="t-h1">{archive ? 'Archiv' : 'Sessions'}</h1>
        <Link href={archive ? '/admin' : '/admin?archiv=1'} className="wp-btn-quiet">{archive ? 'Aktuelle Sessions' : 'Archiv'}</Link>
      </div>
      {archive ? null : <NewSessionForm />}
      {sessions.length === 0 ? (
        <p className="t-body rounded-[var(--radius-card)] bg-white px-6 py-8">{archive ? 'Noch nichts archiviert.' : 'Noch keine Sessions. Lege oben deine erste an.'}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sessions.map(s => (
            <li key={s.id} className="relative flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/sessions/${s.id}`} className="t-h3 block [overflow-wrap:anywhere] hover:underline">{s.title}</Link>
                  <p className="t-small mt-1 text-gray">
                    {s.event_date ? formatDate(s.event_date) : `Erstellt am ${formatDate(s.created_at)}`} · {s.live_questions.length} {s.live_questions.length === 1 ? 'Frage' : 'Fragen'} · Code {s.code}
                  </p>
                </div>
                <StatusTag status={s.status} />
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href={`/admin/sessions/${s.id}`} className="wp-btn-quiet">Bearbeiten</Link>
                {s.status !== 'archived' ? <Link href={`/admin/sessions/${s.id}/live`} className="wp-btn-quiet">Live steuern</Link> : null}
                <Link href={`/admin/sessions/${s.id}/ergebnisse`} className="wp-btn-quiet">Ergebnisse</Link>
                <SessionMenu id={s.id} archived={s.status === 'archived'} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
