import { notFound } from 'next/navigation'
import { LiveControl } from '@/app/admin/sessions/[id]/live/LiveControl'
import type { Question, Session, Snapshot } from '@/lib/types'

/** Nur in der Entwicklung: Live-Steuerung mit Beispieldaten (Aktionen ohne Wirkung). */
export default function Preview() {
  if (process.env.NODE_ENV === 'production') notFound()
  const sid = '00000000-0000-4000-8000-000000000000'
  const titles: [Question['type'], string][] = [
    ['choice', 'Wie häufig nutzt du ChatGPT?'], ['wordcloud', 'Welches Wort verbindest du mit künstlicher Intelligenz?'],
    ['yesno', 'Hast du heute bereits KI verwendet?'], ['scale', 'Wie sicher fühlst du dich im Umgang mit KI?'], ['open', 'Was möchtest du heute lernen?'],
  ]
  const questions: Question[] = titles.map(([type, title], i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, session_id: sid, position: i + 1, type, title, description: null, config: {}, enabled: true }))
  const session = { id: sid, code: 'R9FXJ5', present_token: '', title: 'Test KI BASIC – Spiez', description: null, event_date: null, status: 'live', current_question_id: questions[4].id, voting_open: true, results_visible: true, show_qr: false, auto_show_results: true, state_version: 1, started_at: null, ended_at: null, created_at: '' } satisfies Session
  const snap: Snapshot = {
    sessionId: sid, code: 'R9FXJ5', title: session.title, status: 'live', votingOpen: true, resultsVisible: true, showQr: false, reveal: false, deadline: null, serverNow: 0, version: 1, participants: 3, responses: 2,
    question: { id: questions[4].id, type: 'open', title: questions[4].title, description: null, config: {}, number: 5, total: 5 },
    results: { type: 'open', respondents: 2, items: [{ id: 'a', text: 'Gute Prompts schreiben', status: 'visible', at: '' }, { id: 'b', text: 'Bilder erstellen', status: 'pending', at: '' }] },
  }
  return (
    <div className="min-h-dvh bg-mist p-10">
      <LiveControl session={session} questions={questions} initial={snap} joinUrl="https://live.weprompt.ch/join/R9FXJ5" joinLabel="live.weprompt.ch/join/R9FXJ5" presentUrl="#" />
    </div>
  )
}
