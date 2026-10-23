'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Logo, Sparkle } from '@/components/ui'
import { anonClient } from '@/lib/supabase/browser'
import { useLiveChannel } from '@/lib/realtime'
import { hasAnswered, participantId, rememberAnswered } from '@/lib/participant'
import { optionsOf, type AnswerValue, type JoinState, type PublicQuestion, type PublicState } from '@/lib/types'

export function Participant({ code, initial }: { code: string; initial: JoinState }) {
  const [state, setState] = useState<JoinState>(initial)
  const pid = useRef<string | null>(null)
  const version = useRef(initial.version)

  const apply = useCallback((next: PublicState, answered?: boolean) => {
    if (next.version < version.current) return // verspätete Meldung
    version.current = next.version
    setState(prev => ({
      ...next,
      answered: answered ?? (next.question ? (next.question.id === prev.question?.id ? prev.answered : hasAnswered(code, next.question.id)) : false),
    }))
  }, [code])

  const refresh = useCallback(async (jitter = false) => {
    // Nach einem Unterbruch melden sich viele Handys gleichzeitig: leicht verteilen.
    if (jitter) await new Promise(r => setTimeout(r, Math.random() * 600))
    try {
      const res = await fetch(`/api/join/${code}?pid=${pid.current ?? ''}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as JoinState
      const local = data.question ? hasAnswered(code, data.question.id) : false
      version.current = Math.min(version.current, data.version) // Server ist massgebend
      apply(data, data.answered || local)
    } catch { /* offline: der nächste Versuch kommt automatisch */ }
  }, [code, apply])

  useEffect(() => {
    pid.current = participantId(code)
    refresh()
  }, [code, refresh])

  const connection = useLiveChannel({
    client: anonClient,
    topics: [`live:${state.sessionId}`],
    handlers: { state: payload => apply(payload as PublicState) },
    onResync: () => refresh(true),
  })

  const markAnswered = useCallback((questionId: string) => {
    rememberAnswered(code, questionId)
    setState(s => (s.question?.id === questionId ? { ...s, answered: true } : s))
  }, [code])

  return (
    <main className="on-violett flex min-h-dvh flex-col px-4 pb-8 pt-5">
      <header className="mx-auto flex w-full max-w-[560px] items-center justify-between gap-4">
        <Logo tone="weiss" className="h-6 w-auto" />
        <p className="t-small min-w-0 truncate text-right text-white/85">{state.title}</p>
      </header>
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col pt-8">
        <Screen state={state} code={code} pid={pid} onAnswered={markAnswered} onClosed={() => refresh()} />
      </div>
      {connection === 'offline' ? (
        <p role="status" className="t-small mx-auto mt-6 rounded-[var(--radius-pill)] bg-white/15 px-4 py-2 text-white">Verbindung wird wiederhergestellt …</p>
      ) : null}
    </main>
  )
}

function Screen({ state, code, pid, onAnswered, onClosed }: {
  state: JoinState
  code: string
  pid: React.RefObject<string | null>
  onAnswered: (questionId: string) => void
  onClosed: () => void
}) {
  if (state.status === 'ended' || state.status === 'archived') {
    return <Message title="Danke fürs Mitmachen!">Die Session ist beendet. Du kannst dieses Fenster schliessen.</Message>
  }
  const q = state.question
  if (!q) {
    return <Message title="Gleich geht's los." waiting>Warte auf die nächste Frage.</Message>
  }
  if (state.answered) {
    return <Message title="Danke! Deine Antwort wurde gespeichert." waiting>Die nächste Frage erscheint hier automatisch.</Message>
  }
  if (!state.votingOpen) {
    return (
      <>
        <QuestionHead q={q} />
        <Message title="Die Abstimmung ist geschlossen." waiting>Warte auf die nächste Frage.</Message>
      </>
    )
  }
  return (
    <>
      <QuestionHead q={q} />
      <AnswerForm key={q.id} q={q} code={code} pid={pid} onAnswered={onAnswered} onClosed={onClosed} />
    </>
  )
}

function QuestionHead({ q }: { q: PublicQuestion }) {
  return (
    <div className="mb-7">
      {q.total > 1 ? <p className="t-caption text-white/80">Frage {q.number} von {q.total}</p> : null}
      <h1 className="t-h2 mt-2 text-white [overflow-wrap:anywhere]">{q.title}</h1>
      {q.description ? <p className="t-body mt-3 text-white/90">{q.description}</p> : null}
    </div>
  )
}

function Message({ title, children, waiting = false }: { title: string; children: ReactNode; waiting?: boolean }) {
  return (
    <div className="wp-rise mt-4 flex items-end gap-3" role="status">
      <span className="wp-avatar" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bildmarke-schwarz.svg" alt="" />
      </span>
      <div className="wp-bubble wp-bubble-brand min-w-0 flex-1 pb-6">
        <p className="t-h3">{title}</p>
        <p className="t-body mt-2">{children}</p>
        {waiting ? <Sparkle className="wp-pulse mt-4 h-6 w-6 text-black" /> : null}
      </div>
    </div>
  )
}

function AnswerForm({ q, code, pid, onAnswered, onClosed }: {
  q: PublicQuestion
  code: string
  pid: React.RefObject<string | null>
  onAnswered: (questionId: string) => void
  onClosed: () => void
}) {
  const [value, setValue] = useState<AnswerValue | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!value || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, participantId: pid.current ?? participantId(code), value }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) return onAnswered(q.id)
      setError(data.message ?? 'Das hat nicht geklappt. Bitte nochmals senden.')
      if (res.status === 409 || res.status === 404) onClosed()
    } catch {
      setError('Keine Verbindung. Prüfe dein Internet und sende nochmals.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); send() }} className="flex flex-col">
      <div>
        {q.type === 'choice' || q.type === 'yesno' ? <ChoiceInput q={q} onChange={setValue} /> : null}
        {q.type === 'scale' ? <ScaleInput q={q} onChange={setValue} /> : null}
        {q.type === 'wordcloud' ? <WordsInput q={q} onChange={setValue} /> : null}
        {q.type === 'open' ? <OpenInput q={q} onChange={setValue} /> : null}
      </div>
      {error ? <p role="alert" className="t-body mt-6 rounded-[16px] bg-white px-4 py-3 text-black ring-2 ring-coral">{error}</p> : null}
      <div className="mt-6">
        <button type="submit" className="wp-btn wp-btn-primary wp-btn-block min-h-[58px]" disabled={!value || sending} aria-busy={sending}>
          {sending ? 'Wird gesendet …' : 'Antwort senden'}
        </button>
      </div>
    </form>
  )
}

function ChoiceInput({ q, onChange }: { q: PublicQuestion; onChange: (v: AnswerValue | null) => void }) {
  const multiple = q.type === 'choice' && Boolean(q.config.multiple)
  const options = optionsOf(q.type, q.config)
  const max = multiple ? Math.min(q.config.maxChoices ?? options.length, options.length) : 1
  const [picked, setPicked] = useState<string[]>([])

  function toggle(id: string) {
    let next: string[]
    if (!multiple) next = [id]
    else if (picked.includes(id)) next = picked.filter(x => x !== id)
    else if (picked.length >= max) return
    else next = [...picked, id]
    setPicked(next)
    onChange(next.length ? { options: next } : null)
  }

  return (
    <div>
      {multiple ? <p className="t-small mb-3 text-white/85">{max < options.length ? `Wähle bis zu ${max} Antworten.` : 'Mehrere Antworten möglich.'}</p> : null}
      <div role={multiple ? 'group' : 'radiogroup'} aria-label="Antwortmöglichkeiten" className={q.type === 'yesno' ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={picked.includes(o.id)}
            className={`choice-tile ${q.type === 'yesno' ? 'min-h-[110px] justify-center text-center !text-[28px]' : ''}`}
            onClick={() => toggle(o.id)}
          >
            {q.type === 'yesno' ? null : <span className={`choice-mark ${multiple ? 'square' : ''}`} aria-hidden />}
            <span className="min-w-0 [overflow-wrap:anywhere]">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ScaleInput({ q, onChange }: { q: PublicQuestion; onChange: (v: AnswerValue | null) => void }) {
  const min = q.config.min ?? 1
  const max = q.config.max ?? 5
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div>
      <div role="radiogroup" aria-label={`Bewertung von ${min} bis ${max}`} className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(values.length, 5)}, minmax(0, 1fr))` }}>
        {values.map(v => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={picked === v}
            className="choice-tile aspect-square min-h-0 justify-center !p-0 !text-[26px]"
            onClick={() => { setPicked(v); onChange({ value: v }) }}
          >
            {v}
          </button>
        ))}
      </div>
      {q.config.minLabel || q.config.maxLabel ? (
        <div className="t-small mt-3 flex justify-between gap-4 text-white/90">
          <span>{min} = {q.config.minLabel || 'tief'}</span>
          <span className="text-right">{max} = {q.config.maxLabel || 'hoch'}</span>
        </div>
      ) : null}
    </div>
  )
}

function WordsInput({ q, onChange }: { q: PublicQuestion; onChange: (v: AnswerValue | null) => void }) {
  const n = Math.min(Math.max(q.config.maxWords ?? 1, 1), 10)
  const [words, setWords] = useState<string[]>(Array(n).fill(''))
  function set(i: number, w: string) {
    const next = words.map((x, j) => (j === i ? w : x))
    setWords(next)
    const filled = next.map(x => x.trim()).filter(Boolean)
    onChange(filled.length ? { words: filled } : null)
  }
  return (
    <div className="wp-bubble wp-bubble-brand flex flex-col gap-5 pb-6">
      <p className="t-small">{n > 1 ? `Bis zu ${n} Begriffe, je ein Begriff pro Feld.` : 'Ein Begriff.'}</p>
      {words.map((w, i) => (
        <div key={i} className="wp-field">
          <label htmlFor={`w${i}`}>{n > 1 ? `Begriff ${i + 1}${i > 0 ? ' (freiwillig)' : ''}` : 'Dein Begriff'}</label>
          <input id={`w${i}`} className="wp-input !text-[20px]" maxLength={40} autoComplete="off" enterKeyHint={i < n - 1 ? 'next' : 'send'} value={w} onChange={e => set(i, e.target.value)} autoFocus={i === 0} />
        </div>
      ))}
    </div>
  )
}

function OpenInput({ q, onChange }: { q: PublicQuestion; onChange: (v: AnswerValue | null) => void }) {
  const max = q.config.maxLength ?? 200
  const [text, setText] = useState('')
  return (
    <div className="wp-bubble wp-bubble-brand pb-5">
      <div className="wp-field">
        <label htmlFor="answer">Deine Antwort</label>
        <textarea
          id="answer"
          className="wp-input !min-h-[130px] !text-[19px]"
          maxLength={max}
          value={text}
          onChange={e => { setText(e.target.value); onChange(e.target.value.trim() ? { text: e.target.value } : null) }}
          aria-describedby="answer-count"
        />
        <span id="answer-count" className="wp-hint text-right">{text.length}/{max}</span>
      </div>
      {q.config.moderation ? <p className="t-small mt-3">Antworten erscheinen nach Freigabe durch die Kursleitung.</p> : null}
    </div>
  )
}
