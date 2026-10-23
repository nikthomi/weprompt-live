'use client'

import { useFormStatus } from 'react-dom'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function SubmitButton({ children, pendingLabel, className = 'wp-btn wp-btn-primary', disabled, ...rest }: {
  children: ReactNode
  pendingLabel?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'>) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending} {...rest}>
      {pending ? (pendingLabel ?? 'Bitte warten …') : children}
    </button>
  )
}

export function Field({ label, id, hint, ...input }: { label: string; id: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="wp-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={input.name ?? id} className="wp-input" aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint ? <span id={`${id}-hint`} className="wp-hint">{hint}</span> : null}
    </div>
  )
}
