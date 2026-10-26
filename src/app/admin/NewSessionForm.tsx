'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/form'
import { Notice } from '@/components/ui'
import { createSession } from './actions'

export function NewSessionForm() {
  const [state, action] = useActionState(createSession, undefined)
  return (
    <details className="group rounded-[var(--radius-card)] bg-amber">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="t-h3 block">Neue Session</span>
          <span className="t-small mt-1 block text-black/70">Titel und Datum festlegen</span>
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black font-[family-name:var(--font-brand)] text-2xl font-medium leading-none text-white transition-transform group-open:rotate-45" aria-hidden>+</span>
      </summary>
      <form action={action} className="border-t border-black/15 px-6 pb-6 pt-5 md:px-8 md:pb-8">
        <div className="grid gap-6 md:grid-cols-[1fr_200px_auto] md:items-end">
          <div className="wp-field">
            <label htmlFor="title">Titel</label>
            <input id="title" name="title" className="wp-input" required maxLength={160} placeholder="z. B. KI BASIC – Spiez" />
          </div>
          <div className="wp-field">
            <label htmlFor="event_date">Datum (freiwillig)</label>
            <input id="event_date" name="event_date" type="date" className="wp-input" />
          </div>
          <SubmitButton pendingLabel="Anlegen …">Anlegen</SubmitButton>
        </div>
        {state?.error ? <div className="mt-4"><Notice tone="error">{state.error}</Notice></div> : null}
      </form>
    </details>
  )
}
