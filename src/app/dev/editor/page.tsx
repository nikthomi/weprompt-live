import { notFound } from 'next/navigation'
import { QuestionEditor } from '@/app/admin/sessions/[id]/QuestionEditor'
import type { Question } from '@/lib/types'

/** Nur in der Entwicklung: Fragen-Editor eines Quiz mit Beispieldaten (Speichern ohne Wirkung). */
export default function Preview() {
  if (process.env.NODE_ENV === 'production') notFound()
  const question: Question = {
    id: '00000000-0000-4000-8000-0000000000aa', session_id: '00000000-0000-4000-8000-000000000000', position: 1,
    type: 'quiz', title: 'Foto oder KI?', description: null, config: { correct: 'no', seconds: 20 }, enabled: true,
  }
  return (
    <main className="min-h-dvh bg-mist p-10">
      <div className="mx-auto max-w-[900px] rounded-[var(--radius-card)] bg-white">
        <QuestionEditor question={question} responses={0} />
      </div>
    </main>
  )
}
