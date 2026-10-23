'use client'

import { useId, useState, useTransition } from 'react'
import { Notice } from '@/components/ui'
import type { ChoiceOption, Question, QuestionConfig } from '@/lib/types'
import { deleteQuestion, saveQuestion, setQuestionEnabled } from '../../actions'

const newOptionId = () => Math.random().toString(36).slice(2, 8)

export function QuestionEditor({ question, responses }: { question: Question; responses: number }) {
  const [title, setTitle] = useState(question.title === 'Neue Frage' ? '' : question.title)
  const [description, setDescription] = useState(question.description ?? '')
  const [config, setConfig] = useState<QuestionConfig>(question.config)
  const [status, setStatus] = useState<{ error?: string; ok?: boolean }>({})
  const [pending, start] = useTransition()
  const set = (patch: Partial<QuestionConfig>) => { setConfig(c => ({ ...c, ...patch })); setStatus({}) }

  function save() {
    start(async () => {
      const r = await saveQuestion(question.id, { type: question.type, title, description, config })
      setStatus(r.error ? { error: r.error } : { ok: true })
    })
  }

  return (
    <div className="flex flex-col gap-6 border-t border-mist px-5 pb-5 pt-5 md:px-[68px]">
      <div className="wp-field">
        <label htmlFor={`t-${question.id}`}>Frage</label>
        <input id={`t-${question.id}`} className="wp-input" value={title} maxLength={300} autoFocus={!title}
          placeholder={PLACEHOLDER[question.type]} onChange={e => { setTitle(e.target.value); setStatus({}) }} />
      </div>
      <div className="wp-field">
        <label htmlFor={`d-${question.id}`}>Zusatztext (freiwillig)</label>
        <input id={`d-${question.id}`} className="wp-input" value={description} maxLength={1000} onChange={e => { setDescription(e.target.value); setStatus({}) }} />
      </div>

      {question.type === 'choice' ? <ChoiceConfig config={config} set={set} /> : null}
      {question.type === 'scale' ? <ScaleConfig config={config} set={set} /> : null}
      {question.type === 'wordcloud' ? (
        <NumberSelect label="Begriffe pro Person" value={config.maxWords ?? 3} options={[1, 2, 3, 4, 5]} onChange={v => set({ maxWords: v })} />
      ) : null}
      {question.type === 'open' ? (
        <div className="flex flex-col gap-5">
          <NumberSelect label="Maximale Länge (Zeichen)" value={config.maxLength ?? 200} options={[100, 200, 280, 500]} onChange={v => set({ maxLength: v })} />
          <Check checked={Boolean(config.moderation)} onChange={v => set({ moderation: v })}
            label="Antworten erst nach Freigabe auf dem Beamer zeigen" />
        </div>
      ) : null}
      {question.type === 'yesno' ? <p className="wp-hint">Antwortmöglichkeiten: Ja und Nein.</p> : null}

      {responses > 0 && (question.type === 'choice' || question.type === 'scale') ? (
        <Notice tone="info">Diese Frage hat schon {responses} {responses === 1 ? 'Antwort' : 'Antworten'}. Entfernte Optionen fehlen danach in der Auswertung.</Notice>
      ) : null}
      {status.error ? <Notice tone="error">{status.error}</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="wp-btn wp-btn-primary" disabled={pending} onClick={save}>{pending ? 'Speichern …' : 'Speichern'}</button>
        {status.ok ? <span role="status" className="t-small px-2">Gespeichert</span> : null}
        <span className="flex-1" />
        <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => start(() => setQuestionEnabled(question.id, !question.enabled))}>
          {question.enabled ? 'Deaktivieren' : 'Aktivieren'}
        </button>
        <button type="button" className="wp-btn-quiet" disabled={pending}
          onClick={() => { if (confirm(responses ? `Frage mit ${responses} Antworten löschen?` : 'Frage löschen?')) start(() => deleteQuestion(question.id)) }}>
          Löschen
        </button>
      </div>
    </div>
  )
}

const PLACEHOLDER: Record<Question['type'], string> = {
  wordcloud: 'Welches Wort verbindest du mit künstlicher Intelligenz?',
  choice: 'Wie häufig nutzt du ChatGPT?',
  yesno: 'Hast du heute bereits KI verwendet?',
  scale: 'Wie sicher fühlst du dich im Umgang mit KI?',
  open: 'Was ist deine grösste Herausforderung beim Einsatz von KI?',
}

function ChoiceConfig({ config, set }: { config: QuestionConfig; set: (p: Partial<QuestionConfig>) => void }) {
  const options = config.options ?? []
  const update = (next: ChoiceOption[]) => set({ options: next, ...(config.maxChoices && config.maxChoices > next.length ? { maxChoices: next.length } : {}) })
  return (
    <div className="flex flex-col gap-4">
      <p className="wp-label">Antwortmöglichkeiten</p>
      <ol className="flex flex-col gap-3">
        {options.map((o, i) => (
          <li key={o.id} className="flex items-end gap-3">
            <span className="w-6 pb-2 font-[family-name:var(--font-brand)] font-semibold">{i + 1}.</span>
            <input className="wp-input flex-1" aria-label={`Antwort ${i + 1}`} value={o.label} maxLength={120}
              onChange={e => update(options.map(x => (x.id === o.id ? { ...x, label: e.target.value } : x)))} />
            <button type="button" className="mb-1 rounded-full px-3 py-1.5 text-[14px] font-semibold underline underline-offset-4 disabled:opacity-40"
              disabled={options.length <= 2} onClick={() => update(options.filter(x => x.id !== o.id))} aria-label={`Antwort ${i + 1} entfernen`}>
              Entfernen
            </button>
          </li>
        ))}
      </ol>
      {options.length < 12 ? (
        <button type="button" className="wp-btn-quiet self-start" onClick={() => update([...options, { id: newOptionId(), label: '' }])}>Antwort hinzufügen</button>
      ) : null}
      <Check checked={Boolean(config.multiple)} onChange={v => set({ multiple: v, maxChoices: v ? config.maxChoices : undefined })} label="Mehrere Antworten pro Person erlauben" />
      {config.multiple ? (
        <NumberSelect label="Höchstens auswählbar" value={config.maxChoices ?? options.length}
          options={Array.from({ length: Math.max(options.length - 1, 1) }, (_, i) => i + 2).filter(n => n <= options.length)}
          format={n => (n === options.length ? `${n} (alle)` : String(n))}
          onChange={v => set({ maxChoices: v })} />
      ) : null}
    </div>
  )
}

function ScaleConfig({ config, set }: { config: QuestionConfig; set: (p: Partial<QuestionConfig>) => void }) {
  const id = useId()
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <NumberSelect label="Skala" value={config.max ?? 5} options={[5, 10]} format={n => `1 bis ${n}`} onChange={v => set({ max: v, min: 1 })} />
      <div className="wp-field">
        <label htmlFor={`${id}-lo`}>Beschriftung 1</label>
        <input id={`${id}-lo`} className="wp-input" value={config.minLabel ?? ''} maxLength={40} placeholder="unsicher" onChange={e => set({ minLabel: e.target.value })} />
      </div>
      <div className="wp-field">
        <label htmlFor={`${id}-hi`}>Beschriftung {config.max ?? 5}</label>
        <input id={`${id}-hi`} className="wp-input" value={config.maxLabel ?? ''} maxLength={40} placeholder="sehr sicher" onChange={e => set({ maxLabel: e.target.value })} />
      </div>
    </div>
  )
}

function NumberSelect({ label, value, options, onChange, format = String }: {
  label: string
  value: number
  options: number[]
  onChange: (v: number) => void
  format?: (n: number) => string
}) {
  const id = useId()
  return (
    <div className="wp-field max-w-[260px]">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="wp-input cursor-pointer" value={value} onChange={e => onChange(Number(e.target.value))}>
        {options.map(n => <option key={n} value={n}>{format(n)}</option>)}
      </select>
    </div>
  )
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-3 text-[15px] leading-[22px]">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-coral)]" />
      <span>{label}</span>
    </label>
  )
}
