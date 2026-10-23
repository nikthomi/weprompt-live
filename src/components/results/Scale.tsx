/** Skala: Säulen pro Wert, Durchschnitt als grosse Zahl und Markierung auf der Achse. */
export function Scale({ min, max, minLabel, maxLabel, distribution, average, respondents }: {
  min: number
  max: number
  minLabel?: string
  maxLabel?: string
  distribution: Record<string, number>
  average: number | null
  respondents: number
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const top = Math.max(1, ...values.map(v => distribution[v] ?? 0))
  const avg = average === null ? null : Number(average)
  const avgPos = avg === null ? 0 : ((avg - min + 0.5) / values.length) * 100
  return (
    <div className="flex h-full gap-[4cqw]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 items-end gap-[1.2cqw]">
          {values.map(v => {
            const n = distribution[v] ?? 0
            return (
              <div key={v} className="flex h-full flex-1 flex-col items-center justify-end">
                <span className="stage-sub mb-[1cqh] text-white">{n}</span>
                <div className="bar-fill w-full rounded-t-[min(1.4cqw,20px)] bg-amber" style={{ height: `${(n / top) * 82}%`, minHeight: n ? 6 : 2, opacity: n ? 1 : .35 }} />
              </div>
            )
          })}
        </div>
        <div className="relative mt-[1.4cqh] flex gap-[1.2cqw] border-t-2 border-white/40 pt-[1.2cqh]">
          {values.map(v => <span key={v} className="stage-label flex-1 text-center text-white">{v}</span>)}
          {avg !== null ? (
            <span className="bar-fill absolute -top-[1.6cqh] h-[3cqh] w-[3px] -translate-x-1/2 rounded bg-white transition-[left] duration-700" style={{ left: `${avgPos}%` }} aria-hidden />
          ) : null}
        </div>
        {minLabel || maxLabel ? (
          <div className="stage-sub mt-[1cqh] flex justify-between gap-4 text-white/80">
            <span>{minLabel}</span>
            <span className="text-right">{maxLabel}</span>
          </div>
        ) : null}
      </div>
      <div className="flex w-[22cqw] shrink-0 flex-col justify-center text-white">
        <p className="stage-meta text-white/80">Durchschnitt</p>
        <p className="stage-num text-[clamp(30px,10cqw,200px)] leading-none text-amber">{avg === null ? '–' : avg.toFixed(1)}</p>
        <p className="stage-sub mt-[1cqh] text-white/80">{respondents} {respondents === 1 ? 'Antwort' : 'Antworten'}</p>
      </div>
    </div>
  )
}
