'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, SubmitButton } from '@/components/form'
import { Notice } from '@/components/ui'
import { requestPasswordReset, setNewPassword, signIn, type FormState } from './actions'

function Feedback({ state }: { state: FormState }) {
  if (state?.error) return <Notice tone="error">{state.error}</Notice>
  if (state?.ok) return <Notice tone="info">{state.ok}</Notice>
  return null
}

export function LoginForm({ next, email }: { next?: string; email?: string }) {
  const [state, action] = useActionState(signIn, undefined)
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next ?? ''} />
      <Field id="email" label="E-Mail-Adresse" type="email" autoComplete="email" required defaultValue={email} />
      <Field id="password" label="Passwort" type="password" autoComplete="current-password" required />
      <Feedback state={state} />
      <SubmitButton className="wp-btn wp-btn-primary wp-btn-block" pendingLabel="Anmelden …">Anmelden</SubmitButton>
      <Link href="/passwort-vergessen" className="t-small text-center underline underline-offset-4">Passwort vergessen?</Link>
    </form>
  )
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined)
  if (state?.ok) return <Notice tone="info">{state.ok}</Notice>
  return (
    <form action={action} className="flex flex-col gap-6">
      <Field id="email" label="E-Mail-Adresse" type="email" autoComplete="email" required />
      <Feedback state={state} />
      <SubmitButton className="wp-btn wp-btn-primary wp-btn-block" pendingLabel="Senden …">Link senden</SubmitButton>
      <Link href="/login" className="t-small text-center underline underline-offset-4">Zurück zum Login</Link>
    </form>
  )
}

export function NewPasswordForm() {
  const [state, action] = useActionState(setNewPassword, undefined)
  return (
    <form action={action} className="flex flex-col gap-6">
      <Field id="password" label="Neues Passwort" type="password" autoComplete="new-password" minLength={10} required hint="Mindestens 10 Zeichen." />
      <Field id="password2" label="Passwort wiederholen" type="password" autoComplete="new-password" minLength={10} required />
      <Feedback state={state} />
      <SubmitButton className="wp-btn wp-btn-primary wp-btn-block" pendingLabel="Speichern …">Passwort speichern</SubmitButton>
    </form>
  )
}

