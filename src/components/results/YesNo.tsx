import { pct } from '@/lib/format'

/** Ja/Nein: zwei grosse Zahlen über einem geteilten Balken. */
export function YesNo({ counts, respondents }: { counts: Record<string, number>; respondents: number }) {
  const yes = counts.yes ?? 0
  const no = counts.no ?? 0
  const py = pct(yes, respondents)
  const pn = respondents ? 100 - py : 0
  return (
    <div className="flex h-full flex-col justify-center gap-[5cqh]">
      <div className="flex items-end justify-between text-white">
        <div>
          <p className="stage-label text-white/70">Ja</p>
          <p className="stage-num text-[clamp(28px,10cqw,200px)] leading-[.95]">{py}%</p>
          <p className="stage-sub mt-[1cqh] text-white/60">{yes} {yes === 1 ? 'Stimme' : 'Stimmen'}</p>
        </div>
        <div className="text-right">
          <p className="stage-label text-white/70">Nein</p>
          <p className="stage-num text-[clamp(28px,10cqw,200px)] leading-[.95]">{pn}%</p>
          <p className="stage-sub mt-[1cqh] text-white/60">{no} {no === 1 ? 'Stimme' : 'Stimmen'}</p>
        </div>
      </div>
      <div className="flex h-[3.6cqh] min-h-3 gap-[.5cqw] overflow-hidden rounded-full bg-white/15" aria-hidden>
        {respondents ? (
          <>
            <div className="bar-fill h-full rounded-full bg-amber" style={{ width: `${py}%` }} />
            <div className="bar-fill h-full flex-1 rounded-full bg-white/35" style={{ width: `${pn}%` }} />
          </>
        ) : null}
      </div>
    </div>
  )
}
