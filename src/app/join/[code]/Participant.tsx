'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useCountdown } from '@/lib/clock'
import { Logo } from '@/components/ui'
import { anonClient } from '@/lib/supabase/browser'
import { useLiveChannel } from '@/lib/realtime'
import { hasAnswered, participantId, recordQuizResult, rememberAnswered, scoreFrom, storedAnswer, useStoredQuiz } from '@/lib/participant'
import { optionsOf, type AnswerValue, type JoinState, type PublicQuestion, type PublicState } from '@/lib/types'

export function Participant({ code, initial }: { code: string; initial: JoinState }) {
  const [state, setState] = useState<JoinState>(initial)
  const pid = useRef<string | null>(null)
  const version = useRef(initial.version)

  const apply = useCallback((next: PublicState, answered?: boolean) => {
    if (next.version < version.current) return // verspätete Meldung
    version.current = next.version
    setState(prev => {
      const same = next.question?.id === prev.question?.id
      return {
        ...next,
        answered: answered ?? (next.question ? (same ? prev.answered : hasAnswered(code, next.question.id)) : false),
        myAnswer: same ? prev.myAnswer : next.question ? (storedAnswer(code, next.question.id) as AnswerValue | undefined) ?? null : null,
      }
    })
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
      if (data.question && data.myAnswer) {
        const mine = data.myAnswer
        setState(s => (s.question?.id === data.question!.id ? { ...s, myAnswer: mine } : s))
      }
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

  const markAnswered = useCallback((questionId: string, value: AnswerValue) => {
    rememberAnswered(code, questionId, value)
    setState(s => (s.question?.id === questionId ? { ...s, answered: true, myAnswer: value } : s))
  }, [code])

  return (
    <main className="on-violett flex min-h-dvh flex-col px-6 pb-10 pt-6">
      <header className="mx-auto flex w-full max-w-[560px] items-center justify-between gap-4">
        <Logo tone="weiss" className="h-5 w-auto opacity-90" />
        <p className="t-small min-w-0 truncate text-right text-white/60">{state.title}</p>
      </header>
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col pt-14">
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
  onAnswered: (questionId: string, value: AnswerValue) => void
  onClosed: () => void
}) {
  if (state.status === 'ended' || state.status === 'archived') return <Ended code={code} />
  const q = state.question
  if (!q) {
    return <Message title="Gleich geht's los.">Warte auf die nächste Frage.</Message>
  }
  if (q.type === 'board') {
    return (
      <>
        <QuestionHead q={q} />
        <Message title="Schau auf die Leinwand.">Nenne deine Begriffe laut. Die Kursleitung schreibt sie auf und ordnet sie.</Message>
      </>
    )
  }
  if (q.type === 'quiz') {
    return <QuizScreen key={q.id} state={state} q={q} code={code} pid={pid} onAnswered={onAnswered} onClosed={onClosed} />
  }
  if (state.answered) {
    return <Message title="Danke! Deine Antwort wurde gespeichert.">Die nächste Frage erscheint hier automatisch.</Message>
  }
  if (!state.votingOpen) {
    return (
      <>
        <QuestionHead q={q} />
        <Message title="Die Abstimmung ist geschlossen.">Warte auf die nächste Frage.</Message>
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
    <div className="mb-10">
      {q.total > 1 ? <p className="t-small text-white/60">Frage {q.number} von {q.total}</p> : null}
      <h1 className="t-h2 mt-3 text-white [overflow-wrap:anywhere]">{q.title}</h1>
      {q.description ? <p className="t-body mt-3 text-white/75">{q.description}</p> : null}
    </div>
  )
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="wp-fade" role="status">
      <p className="t-h3 text-white">{title}</p>
      <p className="t-body mt-3 text-white/70">{children}</p>
    </div>
  )
}

function AnswerForm({ q, code, pid, onAnswered, onClosed }: {
  q: PublicQuestion
  code: string
  pid: React.RefObject<string | null>
  onAnswered: (questionId: string, value: AnswerValue) => void
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
      if (res.ok) return onAnswered(q.id, value)
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
      <div className="mt-8">
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
      {multiple ? <p className="t-small mb-4 text-white/60">{max < options.length ? `Wähle bis zu ${max} Antworten.` : 'Mehrere Antworten möglich.'}</p> : null}
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
        <div className="t-small mt-4 flex justify-between gap-4 text-white/60">
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
    <div className="flex flex-col gap-6 rounded-[var(--radius-card)] bg-white px-5 pb-6 pt-5">
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
    <div className="rounded-[var(--radius-card)] bg-white px-5 pb-5 pt-5">
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

/**
 * Quiz: zwei grosse Kacheln, ein Tipp sendet sofort. Nach der Auflösung
 * persönliches Ergebnis und Bilanz dieses Geräts.
 */
function QuizScreen({ state, q, code, pid, onAnswered, onClosed }: {
  state: JoinState
  q: PublicQuestion
  code: string
  pid: React.RefObject<string | null>
  onAnswered: (questionId: string, value: AnswerValue) => void
  onClosed: () => void
}) {
  const left = useCountdown(state.reveal ? null : state.deadline, state.serverNow)
  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mine = state.myAnswer && 'options' in state.myAnswer ? state.myAnswer.options[0] : null
  const options = optionsOf('quiz', q.config)
  const label = (id: string | null | undefined) => options.find(o => o.id === id)?.label ?? ''
  const timeUp = left === 0 || !state.votingOpen

  const correct = state.reveal ? q.config.correct : undefined
  const stored = useStoredQuiz(code)
  useEffect(() => {
    if (correct && mine) recordQuizResult(code, q.id, mine === correct)
  }, [correct, mine, code, q.id])

  async function answer(id: 'yes' | 'no') {
    if (sending || mine) return
    setSending(id)
    setError(null)
    const value = { options: [id] }
    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, participantId: pid.current ?? participantId(code), value }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) return onAnswered(q.id, value)
      setError(res.status === 409 ? 'Die Zeit ist abgelaufen.' : data.message ?? 'Das hat nicht geklappt. Tipp nochmals.')
      if (res.status === 409 || res.status === 404) onClosed()
    } catch {
      setError('Keine Verbindung. Prüfe dein Internet und tipp nochmals.')
    } finally {
      setSending(null)
    }
  }

  const head = (
    <div className="mb-8">
      <div className="flex items-baseline justify-between gap-4">
        {q.total > 1 ? <p className="t-small text-white/60">Frage {q.number} von {q.total}</p> : <span />}
        {left !== null && left > 0 && !mine ? <p className="t-small tabular-nums text-white/80" role="timer">Noch {Math.ceil(left)} s</p> : null}
      </div>
      <h1 className="t-h2 mt-3 text-white [overflow-wrap:anywhere]">{q.title}</h1>
      {q.config.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.config.imageUrl} alt="" className="mt-6 max-h-[38vh] w-full rounded-[var(--radius-card)] object-contain" />
      ) : null}
    </div>
  )

  if (correct) {
    const score = stored === null ? { right: 0, total: 0 } : scoreFrom(stored, mine ? { id: q.id, correct: mine === correct } : undefined)
    return (
      <>
        {head}
        <Message title={!mine ? 'Keine Antwort abgegeben.' : mine === correct ? 'Richtig!' : 'Leider falsch.'}>
          {`Die richtige Antwort ist «${label(correct)}».`}
          {score.total ? ` Bisher hast du ${score.right} von ${score.total} richtig.` : ''}
        </Message>
      </>
    )
  }
  if (mine) {
    return (
      <>
        {head}
        <Message title={`Deine Antwort: ${label(mine)}`}>Gleich kommt die Auflösung.</Message>
      </>
    )
  }
  if (timeUp) {
    return (
      <>
        {head}
        <Message title="Die Zeit ist abgelaufen.">Gleich kommt die Auflösung.</Message>
      </>
    )
  }
  return (
    <>
      {head}
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Antwort wählen">
        {(['yes', 'no'] as const).map(id => (
          <button key={id} type="button" className="choice-tile min-h-[120px] justify-center text-center !text-[26px]"
            disabled={Boolean(sending)} aria-busy={sending === id} onClick={() => answer(id)}>
            {sending === id ? '…' : label(id)}
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="t-body mt-6 rounded-[16px] bg-white px-4 py-3 text-black ring-2 ring-coral">{error}</p> : null}
    </>
  )
}

function Ended({ code }: { code: string }) {
  const score = scoreFrom(useStoredQuiz(code))
  return (
    <Message title="Danke fürs Mitmachen!">
      {score.total ? `Im Quiz hattest du ${score.right} von ${score.total} richtig. ` : ''}Die Session ist beendet. Du kannst dieses Fenster schliessen.
    </Message>
  )
}
