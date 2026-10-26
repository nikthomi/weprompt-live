import type { OpenItem } from '@/lib/types'

/**
 * Offene Antworten als ruhige Karten (leicht aufgehelltes violett), neueste zuerst. Neue Karten erscheinen mit einer kurzen Einblendung.
 */
export function AnswerCards({ items }: { items: OpenItem[] }) {
  const visible = items.filter(i => i.status === 'visible').slice(0, 40)
  const size = visible.length > 18 ? 'text-[clamp(11px,1.35cqw,26px)]' : visible.length > 8 ? 'text-[clamp(12px,1.7cqw,32px)]' : visible.length > 3 ? 'text-[clamp(13px,2.2cqw,42px)]' : 'text-[clamp(14px,2.8cqw,54px)]'
  return (
    <div className="h-full overflow-hidden [mask-image:linear-gradient(to_bottom,black_88%,transparent)]">
      <ul className={`gap-[1.6cqw] ${visible.length > 8 ? 'columns-3' : 'columns-2'}`}>
        {visible.map(item => (
          <li key={item.id} className="wp-rise mb-[1.6cqw] break-inside-avoid">
            <p className={`rounded-[min(1.4cqw,20px)] bg-white/10 px-[1.8cqw] py-[1.5cqw] font-[family-name:var(--font-text)] font-medium leading-snug text-white [overflow-wrap:anywhere] ${size}`}>
              {item.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
