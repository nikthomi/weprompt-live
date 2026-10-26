'use client'

import { QuizTiles, TimerRing } from '@/components/results/Quiz'
import { useCountdown } from '@/lib/clock'
import type { Snapshot } from '@/lib/types'

/** Quizfrage auf der Bühne: Aussage, Bild, Timer, danach die Auflösung. */
export function QuizStage({ snap }: { snap: Snapshot }) {
  const q = snap.question!
  const left = useCountdown(snap.reveal ? null : snap.deadline, snap.serverNow)
  const counts = snap.reveal && snap.results?.type === 'quiz' ? snap.results.counts : null
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-[3cqw]">
        <h1 className="stage-title max-w-[78cqw] [overflow-wrap:anywhere]">{q.title}</h1>
        {left !== null && left > 0 ? <TimerRing left={left} total={q.config.seconds ?? 20} /> : null}
      </div>
      {q.description ? <p className="stage-sub mt-[1.5cqh] max-w-[70cqw] text-white/75">{q.description}</p> : null}
      <div className="flex min-h-0 flex-1 items-center justify-center py-[3cqh]">
        {q.config.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.config.imageUrl} alt="" className="max-h-full max-w-full rounded-[min(1.2cqw,16px)] object-contain" />
        ) : null}
      </div>
      <QuizTiles counts={counts} respondents={snap.results?.respondents ?? 0} correct={snap.reveal ? q.config.correct : undefined} />
    </div>
  )
}

/** Fusszeile für Quizfragen: läuft, Zeit abgelaufen oder aufgelöst. */
export function QuizStatus({ snap }: { snap: Snapshot }) {
  const left = useCountdown(snap.reveal ? null : snap.deadline, snap.serverNow)
  const label = snap.reveal ? 'Aufgelöst' : left === 0 || !snap.votingOpen ? 'Zeit abgelaufen' : 'Abstimmung läuft'
  return <span>{label}</span>
}
