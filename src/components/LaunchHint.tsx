'use client'

import { useState, useSyncExternalStore } from 'react'

const KEY = 'wp-live:present-hint'
const noop = () => () => {}

/** Zeigt nach «Live steuern» einmal, wo die Präsentation gelandet ist. */
export function LaunchHint() {
  const stored = useSyncExternalStore(noop, () => { try { return sessionStorage.getItem(KEY) } catch { return null } }, () => null)
  const [dismissed, setDismissed] = useState(false)
  if (!stored || dismissed) return null
  return (
    <p role="status" className="t-small flex items-start justify-between gap-4 rounded-[16px] bg-white px-4 py-3">
      <span>{stored}</span>
      <button type="button" className="shrink-0 underline underline-offset-4"
        onClick={() => { try { sessionStorage.removeItem(KEY) } catch { /* egal */ } setDismissed(true) }}>
        OK
      </button>
    </p>
  )
}
