import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/auth'
import { csvFilename, toCsv } from '@/lib/csv'
import { formatDate, formatDateTime, pct } from '@/lib/format'
import { optionsOf, typeLabel, type Question, type Results, type Session } from '@/lib/types'

type Row = (string | number | null)[]

/** CSV-Export: «antworten» = jede Antwort einzeln, «auswertung» = Zahlen pro Frage. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params
  const { supabase, admin } = await getViewer()
  if (!admin) return new NextResponse('Keine Berechtigung', { status: 403 })
  if (kind !== 'antworten' && kind !== 'auswertung') return new NextResponse('Unbekannter Export', { status: 404 })

  const [{ data: session }, { data: qs }] = await Promise.all([
    supabase.from('live_sessions').select('*').eq('id', id).maybeSingle<Session>(),
    supabase.from('live_questions').select('*').eq('session_id', id).order('position'),
  ])
  if (!session) return new NextResponse('Nicht gefunden', { status: 404 })
  const questions = (qs ?? []) as Question[]
  const date = formatDate(session.event_date ?? session.started_at ?? session.created_at)
  const head: Row[] = [['Session', session.title], ['Datum', date], ['Code', session.code], ['Exportiert', formatDateTime(new Date())], []]

  let rows: Row[]
  if (kind === 'antworten') {
    const { data } = await supabase.from('live_responses').select('question_id, participant_id, value, status, created_at')
      .eq('session_id', id).order('created_at').limit(50_000)
    // Teilnehmende als laufende Nummer statt der technischen Kennung.
    const alias = new Map<string, number>()
    const label = (pid: string) => { if (!alias.has(pid)) alias.set(pid, alias.size + 1); return `T${alias.get(pid)}` }
    const qIndex = new Map(questions.map((q, i) => [q.id, i]))
    rows = [['Nr.', 'Frage', 'Typ', 'Teilnehmer/in (anonym)', 'Antwort', 'Status', 'Zeitpunkt']]
    for (const r of data ?? []) {
      const i = qIndex.get(r.question_id)!
      const q = questions[i]
      rows.push([i + 1, q.title, typeLabel(q.type), label(r.participant_id), answerText(q, r.value), r.status === 'visible' ? 'sichtbar' : r.status === 'pending' ? 'nicht freigegeben' : 'ausgeblendet', formatDateTime(r.created_at)])
    }
  } else {
    const { data } = await supabase.rpc('live_admin_results', { p_session_id: id })
    const byId = new Map(((data ?? []) as { questionId: string; results: Results }[]).map(r => [r.questionId, r.results]))
    rows = [['Nr.', 'Frage', 'Typ', 'Antwort / Begriff / Wert', 'Anzahl', 'Prozent der Antwortenden', 'Antwortende']]
    questions.forEach((q, i) => {
      const r = byId.get(q.id)
      const n = r?.respondents ?? 0
      const base = [i + 1, q.title, typeLabel(q.type)]
      if (!r || n === 0) { rows.push([...base, '(keine Antworten)', 0, '', 0]); return }
      if (r.type === 'choice' || r.type === 'yesno') {
        for (const o of optionsOf(q.type, q.config)) rows.push([...base, o.label, r.counts[o.id] ?? 0, `${pct(r.counts[o.id] ?? 0, n)}%`, n])
      } else if (r.type === 'scale') {
        for (let v = q.config.min ?? 1; v <= (q.config.max ?? 5); v++) rows.push([...base, v, r.distribution[v] ?? 0, `${pct(r.distribution[v] ?? 0, n)}%`, n])
        rows.push([...base, 'Durchschnitt', r.average === null ? '' : Number(r.average).toFixed(2), '', n])
      } else if (r.type === 'wordcloud') {
        for (const w of r.words) rows.push([...base, w.hidden ? `${w.text} (ausgeblendet)` : w.text, w.count, `${pct(w.count, n)}%`, n])
      } else if (r.type === 'open') {
        for (const it of r.items) rows.push([...base, it.text, 1, '', n])
      }
    })
  }

  return new NextResponse(toCsv([...head, ...rows]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename(session.title, kind)}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function answerText(q: Question, value: Record<string, unknown>) {
  if (Array.isArray(value.options)) {
    const opts = optionsOf(q.type, q.config)
    return (value.options as string[]).map(id => opts.find(o => o.id === id)?.label ?? `(entfernte Option ${id})`).join(', ')
  }
  if (typeof value.value === 'number') return String(value.value)
  if (Array.isArray(value.words)) return (value.words as string[]).join(', ')
  return String(value.text ?? '')
}
