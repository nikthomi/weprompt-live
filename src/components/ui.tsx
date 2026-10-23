import Link from 'next/link'
import type { ReactNode } from 'react'

export function Logo({ tone = 'schwarz', className = 'h-7 w-auto' }: { tone?: 'schwarz' | 'weiss'; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/brand/wortmarke-${tone}.svg`} alt="WePrompt" className={className} />
}

/** Schwebende mist-Pille wie auf weprompt.ch: Wortmarke links, Aktionen rechts. */
export function TopBar({ home = '/', children }: { home?: string; children?: ReactNode }) {
  return (
    <header className="px-4 pt-4 md:px-10 md:pt-8">
      <nav className="mx-auto flex h-[60px] max-w-[1312px] items-center justify-between gap-4 rounded-[var(--radius-nav)] bg-mist px-5 md:h-[71px] md:px-[39px]">
        <Link href={home} aria-label="Zur Startseite" className="shrink-0">
          <Logo className="h-6 w-auto md:h-8" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 md:gap-3">{children}</div>
      </nav>
    </header>
  )
}

export function Tag({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <span className={`wp-tag${dark ? ' on-dark' : ''}`}>{children}</span>
}

/** Sprechblase. brand = WePrompt spricht (amber, links), guest = die Person selbst (mist, rechts). */
export function Bubble({ from = 'brand', children, className = '' }: { from?: 'brand' | 'guest'; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-end gap-3 ${from === 'guest' ? 'flex-row-reverse' : ''} ${className}`}>
      {from === 'brand' ? (
        <span className="wp-avatar" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bildmarke-schwarz.svg" alt="" />
        </span>
      ) : null}
      <div className={`wp-bubble min-w-0 flex-1 ${from === 'brand' ? 'wp-bubble-brand' : 'wp-bubble-guest'}`}>{children}</div>
    </div>
  )
}

export function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="15" height="12" viewBox="0 0 15 12" fill="currentColor" aria-hidden>
      <path d="M8.352 11.016C8.48 10.488 8.648 9.944 8.856 9.384C9.08 8.808 9.36 8.28 9.696 7.8C10.048 7.32 10.456 6.952 10.92 6.696V6.6L0 6.864V4.128L10.92 4.392V4.296C10.424 3.96 10 3.56 9.648 3.096C9.296 2.616 9.016 2.112 8.808 1.584C8.616 1.04 8.464 0.512 8.352 0H11.208C11.464 1.168 11.92 2.144 12.576 2.928C13.248 3.712 14.056 4.248 15 4.536V6.456C14.056 6.744 13.248 7.288 12.576 8.088C11.92 8.872 11.464 9.848 11.208 11.016H8.352Z" />
    </svg>
  )
}

export function Sparkle({ className = 'h-6 w-6' }: { className?: string }) {
  // Funken-Icon der Marke als Maske, damit es jede Farbe annehmen kann.
  return (
    <span
      aria-hidden
      className={`inline-block bg-current ${className}`}
      style={{ WebkitMask: 'url(/brand/icon-sparkle.svg) center / contain no-repeat', mask: 'url(/brand/icon-sparkle.svg) center / contain no-repeat' }}
    />
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    info: 'bg-mist text-black',
    error: 'bg-white text-black border-l-0 ring-2 ring-coral',
    success: 'bg-amber text-black',
  }[tone]
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-[16px] px-4 py-3 text-[15px] leading-[22px] ${styles}`}>
      {children}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="t-body rounded-[var(--radius-card)] bg-white/10 px-5 py-6 text-white">{children}</p>
}
