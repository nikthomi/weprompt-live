'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Stage } from '@/components/Stage'
import { BoardEditor } from '@/components/board/BoardEditor'
import { useCountdown } from '@/lib/clock'
import { ExportPng, pngName } from '@/components/ExportPng'
import { PresentationWindowButton } from '@/components/PresentationWindowButton'
import { StatusTag } from '@/components/StatusTag'
import { createClient } from '@/lib/supabase/browser'
import { throttle, useLiveChannel } from '@/lib/realtime'
import { typeLabel, type OpenItem, type Question, type Session, type Snapshot, type WordResult } from '@/lib/types'

type Patch = Partial<Pick<Session, 'status' | 'current_question_id' | 'voting_open' | 'results_visible' | 'show_qr'>> & { reveal?: boolean }

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

  // Alle Antworten löschen und zurück auf Entwurf, z. B. nach einem Probedurchlauf.
  const reset = useCallback(() => {
    if (!confirm('Session zurücksetzen? Alle Antworten und Teilnehmenden werden gelöscht, die Session steht wieder auf Entwurf. Fragen und vorbereitete Kategorien bleiben. Das lässt sich nicht rückgängig machen.')) return
    setError(null)
    start(async () => {
      const { error } = await supabase.rpc('live_reset_session', { p_session_id: session.id })
      if (error) setError('Zurücksetzen fehlgeschlagen. Prüfe die Verbindung und versuche es nochmals.')
      await load()
    })
  }, [supabase, session.id, load])

  const index = questions.findIndex(q => q.id === snap.question?.id)
  const isLive = snap.status === 'live'
  const qType = snap.question?.type
  const isQuiz = qType === 'quiz'
  const isBoard = qType === 'board'

  // Quiz: bei Zeitablauf automatisch auflösen.
  const left = useCountdown(isQuiz && !snap.reveal ? snap.deadline : null, snap.serverNow)
  const autoRevealed = useRef<string | null>(null)
  useEffect(() => {
    if (!isQuiz || snap.reveal || left !== 0 || !snap.question) return
    if (autoRevealed.current === `${snap.question.id}:${snap.deadline}`) return
    autoRevealed.current = `${snap.question.id}:${snap.deadline}`
    const t = setTimeout(() => update({ reveal: true }), 400)
    return () => clearTimeout(t)
  }, [isQuiz, snap.reveal, left, snap.question, snap.deadline, update])

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
      if (t.closest('input, textarea, select, [contenteditable], [data-board]') || e.metaKey || e.ctrlKey || e.altKey || !isLive) return
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (snap.question && (e.key === 'o' || e.key === 'O')) update({ voting_open: !snap.votingOpen })
      else if (snap.question && (e.key === 'e' || e.key === 'E')) update(isQuiz ? { reveal: true } : { results_visible: !snap.resultsVisible })
      else if (e.key === 'q' || e.key === 'Q') update({ show_qr: !snap.showQr })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLive, isQuiz, next, prev, update, snap.question, snap.votingOpen, snap.resultsVisible, snap.showQr])

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
          <PresentationWindowButton url={presentUrl} />
          <button type="button" className="wp-btn-quiet" disabled={pending} onClick={reset}>Zurücksetzen</button>
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
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${current ? 'bg-amber' : 'hover:bg-mist'}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-brand)] text-[15px] font-semibold ${current ? 'bg-black text-white' : 'bg-mist'}`}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-[family-name:var(--font-brand)] text-[16px] font-semibold">{q.title}</span>
                      <span className={`block text-[13px] ${current ? 'text-black/75' : 'text-gray'}`}>{typeLabel(q.type)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
          <div className="panel flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="wp-btn-quiet" disabled={pending || !isLive || index < 0} onClick={prev} aria-keyshortcuts="ArrowLeft">← Zurück</button>
              {index < questions.length - 1 ? (
                <button type="button" className="wp-btn wp-btn-primary" disabled={pending || !isLive} onClick={next} aria-keyshortcuts="ArrowRight">
                  {index < 0 ? 'Erste Frage' : 'Nächste Frage'} →
                </button>
              ) : (
                <span className="t-small text-gray">Letzte Frage</span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-mist pt-5">
              {isBoard ? null : (
                <Switch on={snap.votingOpen && left !== 0} disabled={pending || !snap.question} onClick={() => update({ voting_open: !(snap.votingOpen && left !== 0) })} keys="O">
                  {isQuiz ? 'Abstimmung offen (startet den Timer neu)' : 'Abstimmung offen'}
                </Switch>
              )}
              {isQuiz || isBoard ? null : (
                <Switch on={snap.resultsVisible} disabled={pending || !snap.question} onClick={() => update({ results_visible: !snap.resultsVisible })} keys="E">
                  Ergebnisse auf dem Beamer
                </Switch>
              )}
              <Switch on={snap.showQr} disabled={pending || !isLive} onClick={() => update({ show_qr: !snap.showQr })} keys="Q">
                QR-Code auf dem Beamer
              </Switch>
            </div>
            {!isLive ? (
              <p className="t-body rounded-[16px] bg-mist px-4 py-3">
                {snap.status === 'ended' ? 'Die Session ist beendet.' : 'Starte die Session: Der Beamer zeigt dann den QR-Code, und Teilnehmende können beitreten.'}
              </p>
            ) : null}
            {isQuiz && isLive ? (
              <div className="flex flex-wrap items-center gap-4 border-t border-mist pt-5">
                <p className="font-[family-name:var(--font-brand)] text-[16px] font-semibold tabular-nums" aria-live="polite">
                  {snap.reveal ? 'Aufgelöst' : left !== null && left > 0 ? `Noch ${Math.ceil(left)} s` : left === 0 ? 'Zeit abgelaufen' : 'Ohne Timer'}
                  {' · '}{snap.responses} {snap.responses === 1 ? 'Antwort' : 'Antworten'}
                </p>
                {snap.reveal ? null : (
                  <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => update({ reveal: true })} aria-keyshortcuts="E">Jetzt auflösen</button>
                )}
              </div>
            ) : null}
            <p className="t-small text-gray">
              Tastatur: ← → Fragen wechseln · O Abstimmung · {isQuiz ? 'E Auflösen' : 'E Ergebnisse'} · Q QR-Code
            </p>
          </div>

          {isBoard && snap.question ? (
            <div className="panel">
              <p className="wp-label mb-3">Leinwand – erscheint genau so auf dem Beamer</p>
              <BoardEditor key={snap.question.id} questionId={snap.question.id} />
            </div>
          ) : null}

          <div className={`panel !p-3 ${isBoard ? 'hidden' : ''}`}>
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

/** Ein/Aus-Schalter mit Beschriftung: ruhiger als gefüllte Buttons, Zustand auf einen Blick. */
function Switch({ on, children, keys, ...rest }: { on: boolean; children: React.ReactNode; keys: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-keyshortcuts={keys}
      className="group inline-flex items-center gap-3 text-left disabled:cursor-default disabled:opacity-45" {...rest}>
      <span className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${on ? 'bg-black' : 'bg-black/20'}`} aria-hidden>
        <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left] duration-200 ${on ? 'left-[21px]' : 'left-[3px]'}`} />
      </span>
      <span className="font-[family-name:var(--font-brand)] text-[16px] font-semibold">{children}</span>
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
