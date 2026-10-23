import { pct } from '@/lib/format'

/** Ja/Nein: zwei grosse Zahlen über einem geteilten Balken. */
export function YesNo({ counts, respondents }: { counts: Record<string, number>; respondents: number }) {
  const yes = counts.yes ?? 0
  const no = counts.no ?? 0
  const py = pct(yes, respondents)
  const pn = respondents ? 100 - py : 0
  return (
    <div className="flex h-full flex-col justify-center gap-[4cqh]">
      <div className="flex items-end justify-between text-white">
        <div>
          <p className="stage-label">Ja</p>
          <p className="stage-num text-[clamp(28px,11cqw,220px)] leading-[.9] text-amber">{py}%</p>
          <p className="stage-sub text-white/80">{yes} {yes === 1 ? 'Stimme' : 'Stimmen'}</p>
        </div>
        <div className="text-right">
          <p className="stage-label">Nein</p>
          <p className="stage-num text-[clamp(28px,11cqw,220px)] leading-[.9] text-mist">{pn}%</p>
          <p className="stage-sub text-white/80">{no} {no === 1 ? 'Stimme' : 'Stimmen'}</p>
        </div>
      </div>
      <div className="flex h-[7cqh] min-h-4 gap-[.6cqw] overflow-hidden rounded-full bg-white/15" aria-hidden>
        {respondents ? (
          <>
            <div className="bar-fill h-full rounded-full bg-amber" style={{ width: `${py}%` }} />
            <div className="bar-fill h-full flex-1 rounded-full bg-mist" style={{ width: `${pn}%` }} />
          </>
        ) : null}
      </div>
    </div>
  )
}
