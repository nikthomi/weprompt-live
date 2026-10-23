'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CodeEntry({ notFound }: { notFound: boolean }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={e => { e.preventDefault(); if (clean.length === 6) router.push(`/join/${clean}`) }}
    >
      <div className="wp-field">
        <label htmlFor="code">Code</label>
        <input
          id="code"
          className="wp-input text-center font-[family-name:var(--font-brand)] !text-[34px] !font-bold uppercase tracking-[.18em] placeholder:!text-black/30"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={8}
          placeholder="ABC123"
          value={clean}
          onChange={e => setCode(e.target.value)}
          aria-describedby={notFound ? 'code-error' : undefined}
        />
      </div>
      {notFound ? <p id="code-error" role="alert" className="t-body">Zu diesem Code gibt es keine Session. Prüfe die Schreibweise.</p> : null}
      <button type="submit" className="wp-btn wp-btn-primary wp-btn-block" disabled={clean.length !== 6}>Los geht&apos;s</button>
    </form>
  )
}
