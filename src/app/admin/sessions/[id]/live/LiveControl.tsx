'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Stage } from '@/components/Stage'
import { ExportPng, pngName } from '@/components/ExportPng'
import { StatusTag } from '@/components/StatusTag'
import { createClient } from '@/lib/supabase/browser'
import { throttle, useLiveChannel } from '@/lib/realtime'
import { typeLabel, type OpenItem, type Question, type Session, type Snapshot, type WordResult } from '@/lib/types'

type Patch = Partial<Pick<Session, 'status' | 'current_question_id' | 'voting_open' | 'results_visible' | 'show_qr'>>

export function LiveControl({ session, questions, initial, joinUrl, joinLabel, presentUrl }: {
  session: Session
  questions: Question[]
  initial: Snapshot
  joinUrl: string
  joinLabel: string
  presentUrl: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [snap, setSnap] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const stageRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('live_admin_snapshot', { p_session_id: session.id })
    if (data) setSnap(prev => ((data as Snapshot).version < prev.version ? prev : (data as Snapshot)))
  }, [supabase, session.id])
  const loadThrottled = useMemo(() => throttle(load, 700), [load])

  const connection = useLiveChannel({
    client: () => supabase,
    topics: [`live:${session.id}`, `live-results:${session.id}`],
    handlers: { state: () => load(), response: () => loadThrottled() },
    onResync: load,
    fallbackMs: 3000,
  })

  // Frage wurde in einem anderen Tab hinzugefügt oder aktiviert: Liste neu laden.
  useEffect(() => {
    if (snap.question && !questions.some(q => q.id === snap.question!.id)) router.refresh()
  }, [snap.question, questions, router])

  const update = useCallback((patch: Patch) => {
    setError(null)
    start(async () => {
      const { error } = await supabase.from('live_sessions').update(patch).eq('id', session.id)
      if (error) setError('Das hat nicht geklappt. Prüfe die Verbindung und versuche es nochmals.')
      await load()
    })
  }, [supabase, session.id, load])

  const index = questions.findIndex(q => q.id === snap.question?.id)
  const isLive = snap.status === 'live'

  const activate = useCallback((q: Question) => update({
    status: 'live', current_question_id: q.id, voting_open: true, results_visible: session.auto_show_results, show_qr: false,
  }), [update, session.auto_show_results])

  const next = useCallback(() => {
    const q = questions[index + 1]
    if (q) activate(q)
  }, [questions, index, activate])
  const prev = useCallback(() => {
    const q = questions[index - 1]
    if (q) activate(q)
    else if (index === 0) update({ current_question_id: null })
  }, [questions, index, activate, update])

  // Tastatur: Pfeile = Fragen, O = Abstimmung, E = Ergebnisse, Q = QR-Code.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || !isLive) return
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (snap.question && (e.key === 'o' || e.key === 'O')) update({ voting_open: !snap.votingOpen })
      else if (snap.question && (e.key === 'e' || e.key === 'E')) update({ results_visible: !snap.resultsVisible })
      else if (e.key === 'q' || e.key === 'Q') update({ show_qr: !snap.showQr })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLive, next, prev, update, snap.question, snap.votingOpen, snap.resultsVisible, snap.showQr])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={`/admin/sessions/${session.id}`} className="t-small underline underline-offset-4">← Fragen bearbeiten</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="t-h2 [overflow-wrap:anywhere]">{session.title}</h1>
            <StatusTag status={snap.status} />
          </div>
          <p className="t-small mt-1 text-gray" aria-live="polite">
            Code {snap.code} · {snap.participants} {snap.participants === 1 ? 'Person' : 'Personen'} beigetreten
            {connection === 'live' ? '' : connection === 'offline' ? ' · Verbindung unterbrochen, Daten werden abgefragt' : ' · verbinde …'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={presentUrl} target="wp-live-present" className="wp-btn-quiet">Präsentation öffnen</a>
          {isLive ? (
            <button type="button" className="wp-btn-quiet" disabled={pending}
              onClick={() => { if (confirm('Session beenden? Teilnehmende sehen danach «Danke fürs Mitmachen».')) update({ status: 'ended' }) }}>
              Session beenden
            </button>
          ) : (
            <button type="button" className="wp-btn wp-btn-primary" disabled={pending} onClick={() => update({ status: 'live', current_question_id: null, show_qr: false })}>
              {snap.status === 'ended' ? 'Wieder öffnen' : 'Session starten'}
            </button>
          )}
        </div>
      </div>

      {error ? <p role="alert" className="rounded-[16px] bg-white px-4 py-3 ring-2 ring-coral">{error}</p> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <nav aria-label="Fragen" className="panel order-2 !p-3 xl:order-1">
          <p className="wp-label px-3 pb-2 pt-1">Fragen</p>
          {questions.length === 0 ? <p className="t-small px-3 pb-3">Keine aktiven Fragen. Lege zuerst Fragen an.</p> : null}
          <ol className="flex flex-col gap-1">
            {questions.map((q, i) => {
              const current = q.id === snap.question?.id
              return (
                <li key={q.id}>
                  <button type="button" disabled={pending} onClick={() => activate(q)} aria-current={current ? 'step' : undefined}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${current ? 'bg-black text-white' : 'hover:bg-mist'}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-brand)] font-bold ${current ? 'bg-coral' : 'bg-amber'}`}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-[family-name:var(--font-brand)] text-[16px] font-semibold">{q.title}</span>
                      <span className={`block text-[13px] ${current ? 'text-white/80' : 'text-gray'}`}>{typeLabel(q.type)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
          <div className="panel flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="wp-btn-quiet" disabled={pending || !isLive || index < 0} onClick={prev} aria-keyshortcuts="ArrowLeft">← Zurück</button>
              <button type="button" className="wp-btn wp-btn-primary" disabled={pending || !isLive || index >= questions.length - 1} onClick={next} aria-keyshortcuts="ArrowRight">
                {index < 0 ? 'Erste Frage' : 'Nächste Frage'} →
              </button>
              <span className="flex-1" />
              <Toggle on={snap.votingOpen} disabled={pending || !snap.question} onClick={() => update({ voting_open: !snap.votingOpen })} keys="O">
                {snap.votingOpen ? 'Abstimmung schliessen' : 'Abstimmung öffnen'}
              </Toggle>
              <Toggle on={snap.resultsVisible} disabled={pending || !snap.question} onClick={() => update({ results_visible: !snap.resultsVisible })} keys="E">
                {snap.resultsVisible ? 'Ergebnisse ausblenden' : 'Ergebnisse zeigen'}
              </Toggle>
              <Toggle on={snap.showQr} disabled={pending || !isLive} onClick={() => update({ show_qr: !snap.showQr })} keys="Q">
                {snap.showQr ? 'QR-Code ausblenden' : 'QR-Code zeigen'}
              </Toggle>
            </div>
            {!isLive ? (
              <p className="t-body rounded-[16px] bg-mist px-4 py-3">
                {snap.status === 'ended' ? 'Die Session ist beendet.' : 'Starte die Session: Der Beamer zeigt dann den QR-Code, und Teilnehmende können beitreten.'}
              </p>
            ) : null}
            <p className="t-small text-gray">Tastatur: ← → Fragen wechseln · O Abstimmung · E Ergebnisse · Q QR-Code</p>
          </div>

          <div className="panel !p-3">
            <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
              <p className="wp-label">So sieht es auf dem Beamer aus</p>
              {snap.question ? <ExportPng target={stageRef} filename={pngName(session.title, `frage-${index + 1}`)} /> : null}
            </div>
            <div ref={stageRef} className="aspect-video w-full overflow-hidden rounded-[14px]">
              <Stage snap={snap} joinUrl={joinUrl} joinLabel={joinLabel} />
            </div>
          </div>

          {snap.question && snap.results ? (
            <Moderation snap={snap} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, children, keys, ...rest }: { on: boolean; children: React.ReactNode; keys: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} aria-keyshortcuts={keys} className={`wp-btn-quiet ${on ? '!bg-black !text-white' : ''}`} {...rest}>
      {children}
    </button>
  )
}

/** Moderation: offene Antworten freigeben/ausblenden/löschen, Wörter der Wortwolke ausblenden. */
function Moderation({ snap }: { snap: Snapshot }) {
  const supabase = useMemo(() => createClient(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const r = snap.results
  if (!r || !snap.question) return null

  async function setStatus(item: OpenItem, status: OpenItem['status']) {
    setBusy(item.id)
    await supabase.from('live_responses').update({ status }).eq('id', item.id)
    setBusy(null)
  }
  async function remove(item: OpenItem) {
    if (!confirm('Antwort endgültig löschen?')) return
    setBusy(item.id)
    await supabase.from('live_responses').delete().eq('id', item.id)
    setBusy(null)
  }
  async function toggleWord(w: WordResult) {
    setBusy(w.key)
    if (w.hidden) await supabase.from('live_hidden_words').delete().eq('question_id', snap.question!.id).eq('word_key', w.key)
    else await supabase.from('live_hidden_words').insert({ question_id: snap.question!.id, word_key: w.key })
    setBusy(null)
  }

  if (r.type === 'open') {
    const pending = r.items.filter(i => i.status === 'pending').length
    return (
      <section className="panel" aria-labelledby="mod-h">
        <h2 id="mod-h" className="t-h3">Antworten moderieren</h2>
        <p className="t-small mt-1 text-gray">
          {r.items.length} {r.items.length === 1 ? 'Antwort' : 'Antworten'}{pending ? ` · ${pending} warten auf Freigabe` : ''}
        </p>
        {r.items.length === 0 ? <p className="t-body mt-4">Noch keine Antworten.</p> : null}
        <ul className="mt-4 flex flex-col gap-2">
          {r.items.map(item => (
            <li key={item.id} className={`flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3 ${item.status === 'pending' ? 'bg-amber' : 'bg-mist'} ${item.status === 'hidden' ? 'opacity-60' : ''}`}>
              <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item.status === 'hidden' ? <s>{item.text}</s> : item.text}</p>
              <span className="flex gap-2">
                {item.status !== 'visible' ? (
                  <button type="button" className="wp-btn-quiet" disabled={busy === item.id} onClick={() => setStatus(item, 'visible')}>{item.status === 'pending' ? 'Freigeben' : 'Einblenden'}</button>
                ) : (
                  <button type="button" className="wp-btn-quiet" disabled={busy === item.id} onClick={() => setStatus(item, 'hidden')}>Ausblenden</button>
                )}
                <button type="button" className="wp-btn-quiet" disabled={busy === item.id} onClick={() => remove(item)}>Löschen</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (r.type === 'wordcloud') {
    return (
      <section className="panel" aria-labelledby="mod-h">
        <h2 id="mod-h" className="t-h3">Begriffe</h2>
        <p className="t-small mt-1 text-gray">Antippen blendet einen Begriff auf dem Beamer aus oder wieder ein.</p>
        {r.words.length === 0 ? <p className="t-body mt-4">Noch keine Begriffe.</p> : null}
        <ul className="mt-4 flex flex-wrap gap-2">
          {r.words.map(w => (
            <li key={w.key}>
              <button type="button" disabled={busy === w.key} onClick={() => toggleWord(w)} aria-pressed={!w.hidden}
                className={`rounded-full px-4 py-1.5 text-[15px] font-semibold transition-colors ${w.hidden ? 'bg-white text-gray line-through ring-1 ring-black/20' : 'bg-mist hover:bg-amber'}`}>
                {w.text} <span className="font-medium text-gray">{w.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  return null
}
