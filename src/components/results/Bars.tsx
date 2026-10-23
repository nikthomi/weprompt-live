import type { ChoiceOption } from '@/lib/types'
import { pct } from '@/lib/format'

/**
 * Horizontale Balken für Multiple Choice. Bei Mehrfachauswahl beziehen sich
 * die Prozente auf die Personen, die abgestimmt haben (Summe kann über 100 % liegen).
 */
export function Bars({ options, counts, respondents, multiple }: {
  options: ChoiceOption[]
  counts: Record<string, number>
  respondents: number
  multiple: boolean
}) {
  const max = Math.max(1, ...options.map(o => counts[o.id] ?? 0))
  const rowH = `min(${Math.floor(78 / Math.max(options.length, 1))}cqh, 15cqh)`
  return (
    <div className="flex h-full flex-col justify-center gap-[2.2cqh]">
      <ul className="flex flex-col gap-[2.2cqh]">
        {options.map(o => {
          const n = counts[o.id] ?? 0
          const p = pct(n, respondents)
          return (
            <li key={o.id} className="grid items-center gap-x-[2cqw]" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', minHeight: rowH }}>
              <div className="min-w-0">
                <p className="stage-label truncate text-white">{o.label}</p>
                <div className="mt-[1cqh] h-[3.2cqh] min-h-2.5 overflow-hidden rounded-full bg-white/15">
                  <div className="bar-fill h-full rounded-full bg-amber" style={{ width: `${(n / max) * 100}%` }} />
                </div>
              </div>
              <p className="text-right text-white">
                <span className="stage-num block text-[clamp(16px,3.6cqw,72px)] leading-none">{p}%</span>
                <span className="stage-sub block text-white/80">{n} {n === 1 ? 'Stimme' : 'Stimmen'}</span>
              </p>
            </li>
          )
        })}
      </ul>
      {multiple ? (
        <p className="stage-sub text-white/80">Mehrfachauswahl: Anteil der {respondents} Personen, die diese Option gewählt haben.</p>
      ) : null}
    </div>
  )
}
