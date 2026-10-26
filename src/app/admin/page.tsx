import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { presentUrl } from '@/lib/app-url'
import { StatusTag } from '@/components/StatusTag'
import { LiveControlLauncher } from '@/components/LiveControlLauncher'
import type { Session } from '@/lib/types'
import { NewSessionForm } from './NewSessionForm'
import { SessionMenu } from './SessionMenu'

export const metadata: Metadata = { title: 'Sessions' }

type Row = Pick<Session, 'id' | 'title' | 'code' | 'status' | 'event_date' | 'created_at' | 'present_token'> & { live_questions: { id: string }[] }

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ archiv?: string }> }) {
  const archive = (await searchParams).archiv === '1'
  const { supabase, admin } = await requireAdmin()
  let query = supabase.from('live_sessions').select('id, title, code, status, event_date, created_at, present_token, live_questions!live_questions_session_id_fkey(id)')
  query = archive ? query.eq('status', 'archived') : query.neq('status', 'archived')
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
  if (error) throw new Error(`Sessions konnten nicht geladen werden: ${error.message}`)
  const sessions = (data ?? []) as Row[]

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h1">{archive ? 'Archiv' : 'Sessions'}</h1>
          <p className="t-small mt-2 text-gray">
            {sessions.length} {sessions.length === 1 ? 'Session' : 'Sessions'}
          </p>
        </div>
        <Link href={archive ? '/admin' : '/admin?archiv=1'} className="wp-btn-quiet">{archive ? 'Aktuelle Sessions' : 'Archiv'}</Link>
      </div>
      {archive ? null : <NewSessionForm />}
      {sessions.length === 0 ? (
        <p className="t-body rounded-[var(--radius-card)] bg-white px-6 py-8">{archive ? 'Noch nichts archiviert.' : 'Noch keine Sessions. Lege oben deine erste an.'}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map(s => (
            <li key={s.id}>
              <article className="grid gap-5 rounded-[var(--radius-card)] bg-white p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/admin/sessions/${s.id}`} className="t-h3 [overflow-wrap:anywhere] hover:underline hover:underline-offset-4">{s.title}</Link>
                    <StatusTag status={s.status} compact />
                  </div>
                  <dl className="t-small mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-gray">
                    <div className="flex gap-1"><dt className="sr-only">Datum</dt><dd>{s.event_date ? formatDate(s.event_date) : `Erstellt am ${formatDate(s.created_at)}`}</dd></div>
                    <div className="flex gap-1"><dt className="sr-only">Fragen</dt><dd>{s.live_questions.length} {s.live_questions.length === 1 ? 'Frage' : 'Fragen'}</dd></div>
                    <div className="flex gap-1"><dt>Code</dt><dd className="font-mono font-semibold tracking-[0.12em] text-black">{s.code}</dd></div>
                  </dl>
                </div>
                <div className="flex flex-wrap items-center gap-1 md:justify-end">
                  {s.status !== 'archived' ? (
                    <LiveControlLauncher href={`/admin/sessions/${s.id}/live`} presentationUrl={presentUrl(s.present_token)} className="inline-flex min-h-10 items-center rounded-full bg-black px-5 font-[family-name:var(--font-brand)] text-[15px] font-semibold text-white transition-[background,transform] hover:bg-violett active:scale-[.98]" />
                  ) : (
                    <Link href={`/admin/sessions/${s.id}`} className="inline-flex min-h-10 items-center rounded-full bg-black px-5 font-[family-name:var(--font-brand)] text-[15px] font-semibold text-white transition-[background,transform] hover:bg-violett active:scale-[.98]">Öffnen</Link>
                  )}
                  <Link href={`/admin/sessions/${s.id}`} className="rounded-full px-3 py-2 font-[family-name:var(--font-brand)] text-[15px] font-semibold hover:bg-mist">Bearbeiten</Link>
                  <Link href={`/admin/sessions/${s.id}/ergebnisse`} className="rounded-full px-3 py-2 font-[family-name:var(--font-brand)] text-[15px] font-semibold hover:bg-mist">Ergebnisse</Link>
                  <SessionMenu id={s.id} archived={s.status === 'archived'} canDelete={admin.role === 'admin'} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
