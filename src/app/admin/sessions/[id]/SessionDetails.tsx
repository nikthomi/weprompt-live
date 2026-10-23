'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/form'
import { Notice } from '@/components/ui'
import type { Session } from '@/lib/types'
import { updateSession } from '../../actions'

export function SessionDetails({ session }: { session: Session }) {
  const [state, action] = useActionState(updateSession.bind(null, session.id), undefined)
  return (
    <form action={action} className="panel flex flex-col gap-5" aria-labelledby="details-h">
      <h2 id="details-h" className="t-h3">Session</h2>
      <div className="wp-field">
        <label htmlFor="s-title">Titel</label>
        <input id="s-title" name="title" className="wp-input" defaultValue={session.title} required maxLength={160} />
      </div>
      <div className="wp-field">
        <label htmlFor="s-desc">Beschreibung (intern, freiwillig)</label>
        <textarea id="s-desc" name="description" className="wp-input" defaultValue={session.description ?? ''} maxLength={2000} />
      </div>
      <div className="wp-field">
        <label htmlFor="s-date">Veranstaltungsdatum</label>
        <input id="s-date" name="event_date" type="date" className="wp-input" defaultValue={session.event_date ?? ''} />
      </div>
      <label className="flex items-start gap-3 text-[15px] leading-[22px]">
        <input type="checkbox" name="auto_show_results" defaultChecked={session.auto_show_results} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-coral)]" />
        <span>Ergebnisse beim Aktivieren einer Frage sofort auf dem Beamer zeigen</span>
      </label>
      {state?.error ? <Notice tone="error">{state.error}</Notice> : state?.ok ? <Notice tone="success">Gespeichert.</Notice> : null}
      <SubmitButton className="wp-btn-quiet self-start" pendingLabel="Speichern …">Speichern</SubmitButton>
    </form>
  )
}
