import type { ReactNode } from 'react'
import { Logo } from './ui'

/** Rahmen für Login, Passwort und Aktivierung: violetter Grund, amber Sprechblase. */
export function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="on-violett flex min-h-dvh flex-col items-center px-4 py-10 md:py-16">
      <Logo tone="weiss" className="h-9 w-auto md:h-11" />
      <div className="mt-10 w-full max-w-[520px] md:mt-14">
        <h1 className="t-h1 text-center text-white">{title}</h1>
        {intro ? <div className="t-body mt-4 text-center text-white">{intro}</div> : null}
        <div className="mt-8 flex items-end gap-3">
          <span className="wp-avatar" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/bildmarke-schwarz.svg" alt="" />
          </span>
          <div className="wp-bubble wp-bubble-brand min-w-0 flex-1 pb-6">{children}</div>
        </div>
      </div>
      <p className="t-small mt-auto pt-12 text-white/80">WePrompt Live · Ein Angebot von deeds</p>
    </main>
  )
}
