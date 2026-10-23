import type { OpenItem } from '@/lib/types'

/**
 * Offene Antworten als Sprechblasen der Teilnehmenden (mist, Ecke unten rechts spitz),
 * neueste zuerst. Neue Karten erscheinen mit einer kurzen Einblendung.
 */
export function AnswerCards({ items }: { items: OpenItem[] }) {
  const visible = items.filter(i => i.status === 'visible').slice(0, 40)
  const size = visible.length > 18 ? 'text-[clamp(11px,1.35cqw,26px)]' : visible.length > 8 ? 'text-[clamp(12px,1.7cqw,32px)]' : 'text-[clamp(13px,2.2cqw,42px)]'
  return (
    <div className="h-full overflow-hidden [mask-image:linear-gradient(to_bottom,black_88%,transparent)]">
      <ul className={`gap-[1.4cqw] ${visible.length > 8 ? 'columns-3' : 'columns-2'}`}>
        {visible.map(item => (
          <li key={item.id} className="wp-rise mb-[1.4cqw] break-inside-avoid">
            <p className={`rounded-[min(1.6cqw,25px)] rounded-br-none bg-mist px-[1.6cqw] py-[1.3cqw] font-[family-name:var(--font-text)] font-medium leading-snug text-black [overflow-wrap:anywhere] ${size}`}>
              {item.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
