import type { CSSProperties, ReactNode } from 'react'
import type { BoardItem } from '@/lib/types'
import { BOARD_RATIO, WORD_SIZE } from './geometry'

/**
 * Leinwand der manuellen Wortwolke (nur Anzeige). Füllt den umgebenden
 * Container im festen Seitenverhältnis; Schrift in Prozent der Breite.
 */
export function BoardCanvas({ items, children, className = '' }: { items: BoardItem[]; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`}>
      <div
        className="relative [container-type:inline-size]"
        style={{ width: `min(100cqw, calc(100cqh * ${BOARD_RATIO}))`, aspectRatio: String(BOARD_RATIO) }}
      >
        {items.filter(i => i.kind === 'category').map(c => <Category key={c.id} item={c} />)}
        {items.filter(i => i.kind === 'word').map(w => <Word key={w.id} item={w} />)}
        {children}
      </div>
    </div>
  )
}

export function categoryStyle(c: BoardItem): CSSProperties {
  return { left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${(c.w ?? 0.3) * 100}%`, height: `${(c.h ?? 0.4) * 100}%` }
}

export function wordStyle(w: BoardItem): CSSProperties {
  return { left: `${w.x * 100}%`, top: `${w.y * 100}%`, fontSize: `${WORD_SIZE[w.size] ?? WORD_SIZE[2]}cqw` }
}

export const CATEGORY_CLASS = 'absolute rounded-[1.2cqw] border border-white/25 bg-white/[.04]'
export const CATEGORY_LABEL_CLASS = 'absolute left-[1.2cqw] top-[.9cqw] max-w-[90%] truncate font-[family-name:var(--font-brand)] text-[1.7cqw] font-semibold uppercase tracking-[.04em] text-white/70'
export const WORD_CLASS = 'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white/10 px-[.9em] py-[.3em] font-[family-name:var(--font-brand)] font-semibold leading-none text-white'

function Category({ item }: { item: BoardItem }) {
  return (
    <div className={`${CATEGORY_CLASS} transition-[left,top,width,height] duration-500 ease-out`} style={categoryStyle(item)}>
      <span className={CATEGORY_LABEL_CLASS}>{item.text}</span>
    </div>
  )
}

function Word({ item }: { item: BoardItem }) {
  return (
    <span className={`${WORD_CLASS} wp-fade transition-[left,top,font-size] duration-500 ease-out`} style={wordStyle(item)}>
      {item.text}
    </span>
  )
}
