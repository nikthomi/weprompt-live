import type { ReactNode } from 'react'
import { ResultView } from '@/components/results/ResultView'
import { QrCode } from '@/components/QrCode'
import { Logo } from '@/components/ui'
import type { Snapshot } from '@/lib/types'

/**
 * Bühne für Beamer und Admin-Vorschau. Füllt ihren Container; alle Grössen in
 * Container-Einheiten (cqw/cqh), damit sie auf dem Projektor und in der
 * kleinen Vorschau gleich aussieht.
 */
export function Stage({ snap, joinUrl, joinLabel }: { snap: Snapshot; joinUrl: string; joinLabel: string }) {
  const q = snap.question
  const ended = snap.status === 'ended' || snap.status === 'archived'

  return (
    <div className="stage relative h-full w-full overflow-hidden bg-violett text-white">
      <div className="flex h-full flex-col px-[4.5cqw] pb-[3cqh] pt-[3.5cqh]">
        <header className="flex items-center justify-between gap-[2cqw]">
          <Logo tone="weiss" className="h-[clamp(14px,3.4cqh,48px)] w-auto" />
          {q && !snap.showQr && !ended ? <JoinHint code={snap.code} label={joinLabel} url={joinUrl} /> : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col pt-[4cqh]">
          {ended ? (
            <Center>
              <p className="stage-title">Danke fürs Mitmachen!</p>
              <p className="stage-sub mt-[2cqh] text-white/85">{snap.title}</p>
            </Center>
          ) : !q || snap.showQr ? (
            <Welcome snap={snap} joinUrl={joinUrl} joinLabel={joinLabel} />
          ) : (
            <>
              {q.total > 1 ? <p className="stage-meta text-white/75">Frage {q.number} von {q.total}</p> : null}
              <h1 className="stage-title mt-[1cqh] max-w-[88cqw] [overflow-wrap:anywhere]">{q.title}</h1>
              {q.description ? <p className="stage-sub mt-[1.5cqh] max-w-[80cqw] text-white/85">{q.description}</p> : null}
              <div className="stage relative mt-[4cqh] min-h-0 flex-1">
                {snap.resultsVisible ? (
                  <ResultView question={q} results={snap.results} />
                ) : (
                  <Center>
                    <p className="stage-num text-[clamp(40px,14cqw,280px)] leading-none text-amber">{snap.responses}</p>
                    <p className="stage-label mt-[1cqh] text-white/85">{snap.responses === 1 ? 'Antwort' : 'Antworten'}</p>
                  </Center>
                )}
              </div>
            </>
          )}
        </div>

        {!ended ? (
          <footer className="mt-[2cqh] flex items-center justify-between gap-[2cqw]">
            <StatusPill snap={snap} />
            {q ? <p className="stage-meta text-white/80">{snap.responses} {snap.responses === 1 ? 'Antwort' : 'Antworten'}</p> : null}
          </footer>
        ) : null}
      </div>
    </div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center text-center">{children}</div>
}

function JoinHint({ code, label, url }: { code: string; label: string; url: string }) {
  return (
    <div className="flex items-center gap-[1.4cqw]">
      <p className="stage-meta text-right normal-case">
        <span className="block text-white/80">{label.replace(/\/join\/.*$/, '')}</span>
        <span className="block text-[clamp(13px,2cqw,40px)] tracking-[.12em]">{code}</span>
      </p>
      <QrCode url={url} className="w-[clamp(36px,9cqh,130px)] rounded-[min(.8cqw,10px)] p-[.4cqw]" />
    </div>
  )
}

function Welcome({ snap, joinUrl, joinLabel }: { snap: Snapshot; joinUrl: string; joinLabel: string }) {
  return (
    <div className="grid h-full grid-cols-[1fr_auto] items-center gap-[5cqw]">
      <div className="min-w-0">
        <p className="stage-meta text-white/75">Mach mit</p>
        <h1 className="stage-title mt-[1.5cqh] [overflow-wrap:anywhere]">{snap.title}</h1>
        <p className="stage-sub mt-[3cqh] text-white/90">Scanne den QR-Code oder öffne</p>
        <p className="stage-label mt-[.5cqh] break-all">{joinLabel.replace(/\/join\/.*$/, '')}</p>
        <p className="stage-sub mt-[2cqh] text-white/90">und gib diesen Code ein:</p>
        <p className="stage-num mt-[.5cqh] text-[clamp(28px,7.5cqw,150px)] leading-none tracking-[.12em] text-amber">{snap.code}</p>
        <p className="stage-sub mt-[3cqh] text-white/80">{snap.participants} {snap.participants === 1 ? 'Person ist' : 'Personen sind'} dabei</p>
      </div>
      <div className="rounded-[min(2cqw,25px)] bg-white p-[1.6cqw]">
        <QrCode url={joinUrl} className="w-[min(36cqw,58cqh)]" />
      </div>
    </div>
  )
}

function StatusPill({ snap }: { snap: Snapshot }) {
  if (!snap.question) return <span />
  const open = snap.votingOpen
  return (
    <span className={`stage-meta inline-flex items-center gap-[.8cqw] rounded-full px-[1.4cqw] py-[.7cqh] ${open ? 'bg-white text-black' : 'bg-white/15 text-white'}`}>
      <span className={`inline-block h-[1.1cqh] w-[1.1cqh] min-h-2 min-w-2 rounded-full ${open ? 'wp-pulse bg-coral' : 'bg-white/70'}`} aria-hidden />
      {open ? 'Abstimmung läuft' : 'Abstimmung geschlossen'}
    </span>
  )
}
