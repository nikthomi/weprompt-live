import type { CSSProperties } from 'react'
import { HITS } from '@/lib/podium-timing'

const PIECES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: HITS.first + ((i * 7) % 10) / 12,
  duration: 2.6 + ((i * 13) % 10) / 8,
  color: ['#F6CA70', '#FFFFFF', '#F64462', '#F2F0ED'][i % 4],
  size: 0.7 + ((i * 5) % 4) / 5,
  turn: (i % 2 ? 1 : -1) * (240 + ((i * 29) % 300)),
}))

/** Konfetti, das einmal mit dem letzten Schlag der Siegermelodie fällt. unit: cqw (Bühne) oder vw (Vollbild). */
export function Confetti({ unit = 'cqw', className = '' }: { unit?: 'cqw' | 'vw'; className?: string }) {
  return (
    <div className={`pointer-events-none absolute overflow-hidden ${className}`} aria-hidden>
      {PIECES.map((c, i) => (
        <span key={i} className="wp-confetti absolute top-0 block rounded-[2px]"
          style={{ left: `${c.left}%`, width: `${c.size}${unit}`, height: `${c.size * 1.6}${unit}`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`, '--turn': `${c.turn}deg` } as CSSProperties} />
      ))}
    </div>
  )
}
