'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/form'
import { Notice } from '@/components/ui'
import { createSession } from './actions'

export function NewSessionForm() {
  const [state, action] = useActionState(createSession, undefined)
  return (
    <form action={action} className="rounded-[var(--radius-card)] bg-amber p-6 md:p-8">
      <h2 className="t-h3">Neue Session</h2>
      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_200px_auto] md:items-end">
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
  )
}
