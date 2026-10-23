import Link from 'next/link'
import { Logo } from '@/components/ui'
import { CodeEntry } from './CodeEntry'

export default async function Home({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams
  return (
    <main className="on-violett flex min-h-dvh flex-col items-center px-4 py-10 md:py-16">
      <Logo tone="weiss" className="h-9 w-auto md:h-11" />
      <div className="mt-14 w-full max-w-[460px] md:mt-20">
        <h1 className="t-h1 text-center text-white">Mitmachen</h1>
        <p className="t-body mt-4 text-center text-white">Gib den Code ein, den du auf der Leinwand siehst.</p>
        <div className="mt-8 flex items-end gap-3">
          <span className="wp-avatar" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/bildmarke-schwarz.svg" alt="" />
          </span>
          <div className="wp-bubble wp-bubble-brand min-w-0 flex-1 pb-6">
            <CodeEntry notFound={fehler === 'code'} />
          </div>
        </div>
      </div>
      <p className="t-small mt-auto pt-12 text-white/80">
        WePrompt Live · Ein Angebot von deeds · <Link href="/admin" className="underline underline-offset-4">Für Kursleitende</Link>
      </p>
    </main>
  )
}
