import { pct } from '@/lib/format'
import type { ChoiceOption } from '@/lib/types'

export const LETTERS = 'ABCDEF'

/**
 * Antwort-Kacheln eines Quiz (2 bis 6). Vor der Auflösung nur die Beschriftung,
 * danach Stimmen und Prozent; die richtige Kachel in amber mit Häkchen.
 * Ab drei Antworten mit Buchstaben, damit Beamer und Handy zusammenpassen.
 */
export function QuizTiles({ options, counts, respondents, correct }: {
  options: ChoiceOption[]
  counts: Record<string, number> | null
  respondents: number
  correct: string | undefined
}) {
  const revealed = Boolean(correct && counts)
  const letters = options.length > 2
  const cols = options.length > 4 ? 'grid-cols-3' : 'grid-cols-2'
  return (
    <div className={`grid ${cols} gap-[1.6cqw]`}>
      {options.map((t, i) => {
        const n = counts?.[t.id] ?? 0
        const right = revealed && correct === t.id
        return (
          <div key={t.id}
            className={`flex items-center justify-between gap-[1.6cqw] rounded-[min(1.6cqw,22px)] px-[2cqw] py-[1.8cqh] transition-colors duration-500 ${right ? 'bg-amber text-black' : revealed ? 'bg-white/[.06] text-white/55' : 'bg-white/10 text-white'}`}>
            <span className={`stage-label flex min-w-0 items-center gap-[1cqw] ${options.length > 2 ? '!text-[clamp(12px,1.8cqw,36px)]' : ''}`}>
              {letters ? (
                <span className={`flex h-[1.6em] w-[1.6em] shrink-0 items-center justify-center rounded-full text-[.8em] ${right ? 'bg-black text-amber' : 'bg-white/15'}`}>{LETTERS[i]}</span>
              ) : null}
              {right && !letters ? (
                <svg className="h-[1em] w-[1em] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M4 12.5 9.5 18 20 6" /></svg>
              ) : null}
              <span className="min-w-0 [overflow-wrap:anywhere]">{t.label}</span>
            </span>
            {revealed ? (
              <span className="shrink-0 text-right">
                <span className="stage-num block text-[clamp(14px,2.6cqw,52px)] leading-none">{pct(n, respondents)}%</span>
                <span className="stage-sub block opacity-75">{n} {n === 1 ? 'Stimme' : 'Stimmen'}</span>
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Ruhiger Countdown-Ring; leert sich im Uhrzeigersinn. */
export function TimerRing({ left, total }: { left: number; total: number }) {
  const r = 44
  const c = 2 * Math.PI * r
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0
  return (
    <div className="relative h-[clamp(48px,12cqh,170px)] w-[clamp(48px,12cqh,170px)]" role="timer" aria-label={`Noch ${Math.ceil(left)} Sekunden`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / .18)" strokeWidth="5" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} className="transition-[stroke-dashoffset] duration-200 ease-linear" />
      </svg>
      <span className="stage-num absolute inset-0 flex items-center justify-center text-[clamp(16px,4.4cqh,60px)]">{Math.ceil(left)}</span>
    </div>
  )
}
