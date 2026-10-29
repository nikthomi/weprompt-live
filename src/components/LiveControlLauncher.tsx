'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { OPEN_HINT, openPresentationWindow } from './PresentationWindowButton'

/**
 * «Live steuern»: öffnet die Präsentation (wenn möglich auf dem zweiten
 * Bildschirm) und wechselt im Laptop-Fenster zur Steuerung.
 */
export function LiveControlLauncher({ href, presentationUrl, className }: { href: string; presentationUrl: string; className: string }) {
  const router = useRouter()
  const [hint, setHint] = useState<string | null>(null)

  async function launch() {
    const { window: presentation, result } = await openPresentationWindow(presentationUrl)
    if (!presentation) {
      setHint(OPEN_HINT[result.status])
      return
    }
    const note = OPEN_HINT[result.status]
    if (note) sessionStorage.setItem('wp-live:present-hint', note)
    router.push(href)
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={className} onClick={launch}>Live steuern</button>
      {hint ? <p role="alert" className="t-small max-w-sm text-gray">{hint}</p> : null}
    </div>
  )
}
