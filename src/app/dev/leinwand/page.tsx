import { notFound } from 'next/navigation'
import { BoardEditor } from '@/components/board/BoardEditor'
import { DEMO_BOARD } from '../board-demo'

/** Nur in der Entwicklung: Leinwand-Editor mit Beispieldaten, ohne Speichern. */
export default function Preview() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="min-h-dvh bg-mist p-10">
      <div className="panel mx-auto max-w-[1100px]">
        <BoardEditor questionId="demo" demo={DEMO_BOARD} />
      </div>
    </main>
  )
}
