import { notFound } from 'next/navigation'
import { Participant } from '@/app/join/[code]/Participant'
import type { JoinState, PublicQuestion } from '@/lib/types'
import { serverTime } from '../board-demo'

/** Nur in der Entwicklung: Teilnehmer-Ansicht mit Beispieldaten, ?z=warten|choice|multi|yesno|scale|words|open|danke|zu|quiz|quiz-auf|board */
export default async function Preview({ searchParams }: { searchParams: Promise<{ z?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const z = (await searchParams).z ?? 'choice'
  const now = serverTime()
  const q = (type: PublicQuestion['type'], title: string, config = {}): PublicQuestion => ({ id: `00000000-0000-4000-8000-00000000000${type.length}`, type, title, description: null, config, number: 2, total: 5 })
  const questions: Record<string, PublicQuestion> = {
    choice: q('choice', 'Wie häufig nutzt du ChatGPT?', { options: [{ id: 'a', label: 'Täglich' }, { id: 'b', label: 'Mehrmals pro Woche' }, { id: 'c', label: 'Selten' }, { id: 'd', label: 'Nie' }] }),
    multi: q('choice', 'Wofür nutzt du KI heute schon?', { multiple: true, maxChoices: 2, options: [{ id: 'a', label: 'Texte schreiben' }, { id: 'b', label: 'Recherche' }, { id: 'c', label: 'Übersetzen' }] }),
    yesno: q('yesno', 'Hast du heute bereits KI verwendet?'),
    scale: q('scale', 'Wie sicher fühlst du dich im Umgang mit KI?', { min: 1, max: 5, minLabel: 'unsicher', maxLabel: 'sehr sicher' }),
    words: q('wordcloud', 'Welches Wort verbindest du mit künstlicher Intelligenz?', { maxWords: 3 }),
    open: q('open', 'Was möchtest du heute lernen?', { maxLength: 200, moderation: true }),
    quiz: q('quiz', 'Foto oder KI?', { seconds: 20, imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200' }),
    'quiz-auf': q('quiz', 'Foto oder KI?', { seconds: 20, correct: 'no', imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200' }),
    board: q('board', 'Wo siehst du Chancen und Risiken von KI?'),
  }
  const state: JoinState = {
    sessionId: '00000000-0000-4000-8000-000000000000', code: 'DEVDEV', title: 'KI BASIC – Spiez', status: 'live', version: 999999,
    votingOpen: z !== 'zu', resultsVisible: true, showQr: false, answered: z === 'danke' || z === 'quiz-auf',
    reveal: z === 'quiz-auf', deadline: z === 'quiz' ? now + 15_000 : null, serverNow: now,
    myAnswer: z === 'quiz-auf' ? { options: ['no'] } : null,
    question: z === 'warten' ? null : (questions[z] ?? questions.choice),
  }
  return <Participant code="DEVDEV" initial={state} />
}
