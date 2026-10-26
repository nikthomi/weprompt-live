import type { ReactNode } from 'react'
import { ResultView } from '@/components/results/ResultView'
import { QrCode } from '@/components/QrCode'
import { Logo } from '@/components/ui'
import type { Snapshot } from '@/lib/types'

/**
 * Bühne für Beamer und Admin-Vorschau. Füllt ihren Container; alle Grössen in
 * Container-Einheiten (cqw/cqh), damit sie auf dem Projektor und in der
 * kleinen Vorschau gleich aussieht. Bewusst ruhig: weiss auf violett,
 * amber nur für das Ergebnis, Nebeninfos klein und zurückhaltend.
 */
export function Stage({ snap, joinUrl, joinLabel }: { snap: Snapshot; joinUrl: string; joinLabel: string }) {
  const q = snap.question
  const ended = snap.status === 'ended' || snap.status === 'archived'
  const host = joinLabel.replace(/\/join\/.*$/, '')

  return (
    <div className="stage relative h-full w-full overflow-hidden bg-violett text-white">
      <div className="flex h-full flex-col px-[6cqw] pb-[4.5cqh] pt-[5cqh]">
        <header className="flex items-center justify-between gap-[2cqw]">
          <Logo tone="weiss" className="h-[clamp(12px,2.8cqh,40px)] w-auto opacity-90" />
          {q && !snap.showQr && !ended ? (
            <p className="stage-meta !normal-case !tracking-normal text-white/70">
              {host} · Code <span className="tracking-[.1em] text-white">{snap.code}</span>
            </p>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col pt-[6cqh]">
          {ended ? (
            <Center>
              <p className="stage-title">Danke fürs Mitmachen!</p>
              <p className="stage-sub mt-[2cqh] text-white/70">{snap.title}</p>
            </Center>
          ) : !q || snap.showQr ? (
            <Welcome snap={snap} joinUrl={joinUrl} host={host} />
          ) : (
            <>
              {q.total > 1 ? <p className="stage-meta text-white/60">Frage {q.number} von {q.total}</p> : null}
              <h1 className="stage-title mt-[1.5cqh] max-w-[80cqw] [overflow-wrap:anywhere]">{q.title}</h1>
              {q.description ? <p className="stage-sub mt-[2cqh] max-w-[70cqw] text-white/75">{q.description}</p> : null}
              <div className="stage relative mt-[6cqh] min-h-0 flex-1">
                {snap.resultsVisible ? (
                  <ResultView question={q} results={snap.results} />
                ) : (
                  <Center>
                    <p className="stage-num text-[clamp(36px,11cqw,220px)] leading-none">{snap.responses}</p>
                    <p className="stage-sub mt-[1.5cqh] text-white/70">{snap.responses === 1 ? 'Antwort' : 'Antworten'}</p>
                  </Center>
                )}
              </div>
            </>
          )}
        </div>

        {q && !ended && !snap.showQr ? (
          <footer className="stage-sub mt-[3cqh] flex items-center gap-[1cqw] text-white/60">
            <span>{snap.votingOpen ? 'Abstimmung läuft' : 'Abstimmung geschlossen'}</span>
            <span aria-hidden>·</span>
            <span>{snap.responses} {snap.responses === 1 ? 'Antwort' : 'Antworten'}</span>
          </footer>
        ) : null}
      </div>
    </div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center text-center">{children}</div>
}

function Welcome({ snap, joinUrl, host }: { snap: Snapshot; joinUrl: string; host: string }) {
  return (
    <div className="grid h-full grid-cols-[1fr_auto] items-center gap-[7cqw]">
      <div className="min-w-0">
        <h1 className="stage-title [overflow-wrap:anywhere]">{snap.title}</h1>
        <p className="stage-sub mt-[5cqh] text-white/75">Scanne den QR-Code oder öffne {host} und gib diesen Code ein:</p>
        <p className="stage-num mt-[2cqh] text-[clamp(28px,7cqw,140px)] leading-none tracking-[.12em]">{snap.code}</p>
        <p className="stage-sub mt-[5cqh] text-white/60">{snap.participants} {snap.participants === 1 ? 'Person ist' : 'Personen sind'} dabei</p>
      </div>
      <div className="rounded-[min(1.6cqw,20px)] bg-white p-[1.4cqw]">
        <QrCode url={joinUrl} className="w-[min(30cqw,52cqh)]" />
      </div>
    </div>
  )
}
