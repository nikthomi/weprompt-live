import { pct } from '@/lib/format'
import type { ChoiceOption } from '@/lib/types'

/**
 * Zwei Antwort-Kacheln (z. B. Richtig/Falsch oder Echt/KI). Vor der Auflösung
 * nur die Beschriftung, danach Stimmen und Prozent; die richtige Kachel in
 * amber mit Häkchen.
 */
export function QuizTiles({ options, counts, respondents, correct }: {
  options: ChoiceOption[]
  counts: Record<string, number> | null
  respondents: number
  correct: 'yes' | 'no' | undefined
}) {
  const tiles = options
  const revealed = Boolean(correct && counts)
  return (
    <div className="grid grid-cols-2 gap-[2cqw]">
      {tiles.map(t => {
        const n = counts?.[t.id] ?? 0
        const right = revealed && correct === t.id
        return (
          <div key={t.id}
            className={`flex items-center justify-between gap-[2cqw] rounded-[min(1.6cqw,22px)] px-[2.4cqw] py-[2.2cqh] transition-colors duration-500 ${right ? 'bg-amber text-black' : revealed ? 'bg-white/[.06] text-white/55' : 'bg-white/10 text-white'}`}>
            <span className="stage-label flex items-center gap-[1cqw]">
              {right ? (
                <svg className="h-[1em] w-[1em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M4 12.5 9.5 18 20 6" /></svg>
              ) : null}
              {t.label}
            </span>
            {revealed ? (
              <span className="text-right">
                <span className="stage-num block text-[clamp(14px,3cqw,60px)] leading-none">{pct(n, respondents)}%</span>
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
