'use client'

import { useActionState, useTransition } from 'react'
import { SubmitButton } from '@/components/form'
import { Notice } from '@/components/ui'
import { addTeamMember, removeTeamMember, setTeamRole } from '../actions'

export function AddMember() {
  const [state, action] = useActionState(addTeamMember, undefined)
  return (
    <form action={action} className="rounded-[var(--radius-card)] bg-amber p-6 md:p-8">
      <h2 className="t-h3">Person hinzufügen</h2>
      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_220px_auto] md:items-end">
        <div className="wp-field">
          <label htmlFor="email">E-Mail-Adresse</label>
          <input id="email" name="email" type="email" className="wp-input" required autoComplete="off" />
        </div>
        <div className="wp-field">
          <label htmlFor="role">Rolle</label>
          <select id="role" name="role" className="wp-input" defaultValue="moderator">
            <option value="moderator">Moderation</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <SubmitButton pendingLabel="Hinzufügen …">Hinzufügen</SubmitButton>
      </div>
      {state?.error ? <div className="mt-4"><Notice tone="error">{state.error}</Notice></div> : null}
      {state?.ok ? <p className="t-body mt-4">Hinzugefügt. Die Person legt ihr Passwort unter «Passwort vergessen» auf der Login-Seite fest.</p> : null}
    </form>
  )
}

export function MemberActions({ userId, role }: { userId: string; role: 'admin' | 'moderator' }) {
  const [pending, start] = useTransition()
  return (
    <span className="flex gap-2">
      <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => start(() => setTeamRole(userId, role === 'admin' ? 'moderator' : 'admin'))}>
        {role === 'admin' ? 'Zu Moderation' : 'Zu Admin'}
      </button>
      <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => { if (confirm('Zugang zu WePrompt Live entfernen?')) start(() => removeTeamMember(userId)) }}>Entfernen</button>
    </span>
  )
}
