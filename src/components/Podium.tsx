import type { CSSProperties } from 'react'
import { Avatar } from '@/components/Avatar'
import type { Ranking } from '@/lib/types'

/**
 * Siegerpodest nach der letzten Quizfrage. Spannungsbogen wie bei Kahoot:
 * erst Platz 3, dann Platz 2, zuletzt der Sieg mit Konfetti; danach die
 * weiteren Plätze. Alles in Container-Einheiten, damit Beamer und Vorschau
 * gleich aussehen. Die Animation läuft einmal beim Einblenden.
 */
const SLOTS = [
  // Reihenfolge auf der Bühne: 2 – 1 – 3
  { index: 1, height: 68, delay: 2.4 },
  { index: 0, height: 100, delay: 4.4 },
  { index: 2, height: 48, delay: 0.6 },
]

const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: 5.2 + ((i * 7) % 10) / 10,
  duration: 2.6 + ((i * 13) % 10) / 8,
  color: ['#F6CA70', '#FFFFFF', '#F64462', '#F2F0ED'][i % 4],
  size: 0.7 + ((i * 5) % 4) / 5,
  turn: (i % 2 ? 1 : -1) * (240 + ((i * 29) % 300)),
}))

export function Podium({ ranking }: { ranking: Ranking | null | undefined }) {
  // Zustand kommt vor den Zahlen an: bis dahin leer lassen, damit die Animation erst mit den Namen startet.
  if (!ranking) return null
  const top = ranking.top
  const rest = top.slice(3)

  if (top.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="stage-title">Auswertung</p>
        <p className="stage-sub mt-[2cqh] text-white/70">Noch hat niemand eine Quizfrage beantwortet.</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="pointer-events-none absolute inset-x-0 -top-[12cqh] bottom-0 overflow-hidden" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span key={i} className="wp-confetti absolute top-0 block rounded-[2px]"
            style={{ left: `${c.left}%`, width: `${c.size}cqw`, height: `${c.size * 1.6}cqw`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`, '--turn': `${c.turn}deg` } as CSSProperties} />
        ))}
      </div>

      <div className="wp-fade flex items-baseline justify-between gap-[2cqw]">
        <h1 className="stage-title">Siegerpodest</h1>
        <p className="stage-sub text-white/60">{ranking.players} {ranking.players === 1 ? 'Person' : 'Personen'} · {ranking.total} {ranking.total === 1 ? 'Frage' : 'Fragen'}</p>
      </div>

      <div className="flex min-h-0 flex-1 items-end justify-center gap-[2cqw] pt-[2cqh]">
        {SLOTS.map(slot => {
          const p = top[slot.index]
          if (!p) return <div key={slot.index} className="w-[22cqw]" />
          const first = slot.index === 0
          return (
            <div key={slot.index} className="flex h-full w-[22cqw] flex-col items-center justify-end">
              <div className="wp-pop flex flex-col items-center text-center" style={{ animationDelay: `${slot.delay + 0.55}s` }}>
                <Avatar id={p.avatar} label={p.name}
                  className={`${first ? 'h-[15cqh] w-[15cqh] ring-[0.6cqh]' : 'h-[11cqh] w-[11cqh] ring-[0.4cqh]'} rounded-full ${first ? 'ring-amber' : 'ring-white/80'}`} />
                <p className={`mt-[1.2cqh] max-w-[22cqw] truncate font-[family-name:var(--font-brand)] font-semibold leading-tight ${first ? 'text-[clamp(14px,2.6cqw,52px)]' : 'text-[clamp(12px,2cqw,40px)]'}`}>{p.name}</p>
                <p className="stage-sub mb-[1.4cqh] text-white/75">{p.points.toLocaleString('de-CH')} Punkte</p>
              </div>
              <div className={`wp-grow flex w-full items-start justify-center rounded-t-[min(1.4cqw,18px)] pt-[1.6cqh] ${first ? 'bg-amber text-black' : 'bg-white/15 text-white'}`}
                style={{ height: `${slot.height * (rest.length ? 0.3 : 0.38)}cqh`, animationDelay: `${slot.delay}s` }}>
                <span className="stage-num text-[clamp(18px,5cqh,90px)] leading-none">{p.rank}</span>
              </div>
            </div>
          )
        })}
      </div>

      {rest.length ? (
        <ol className="wp-fade mt-[2.4cqh] grid grid-flow-col grid-cols-2 gap-x-[3cqw] gap-y-[0.8cqh] border-t border-white/15 pt-[2cqh]" style={{ animationDelay: '6.4s', gridTemplateRows: `repeat(${Math.ceil(rest.length / 2)}, auto)` }}>
          {rest.map((p, i) => (
            <li key={i} className="stage-sub flex items-center gap-[1cqw] text-white/80">
              <span className="w-[2.4cqw] text-right tabular-nums text-white/55">{p.rank}.</span>
              <Avatar id={p.avatar} className="h-[3.6cqh] w-[3.6cqh] shrink-0" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="tabular-nums">{p.points.toLocaleString('de-CH')}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
