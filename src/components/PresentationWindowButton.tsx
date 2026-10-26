'use client'

import { useState } from 'react'

const WINDOW_NAME = 'wp-live-present'
const WINDOW_FEATURES = 'popup=yes,width=1280,height=720,resizable=yes,scrollbars=yes'

export function openPresentationWindow(url: string) {
  const presentation = window.open(url, WINDOW_NAME, WINDOW_FEATURES)
  presentation?.focus()
  return presentation
}

/** Öffnet oder fokussiert die Beamer-Ansicht in einem eigenen Browserfenster. */
export function PresentationWindowButton({ url, label = 'Präsentationsfenster öffnen', className = 'wp-btn-quiet' }: { url: string; label?: string; className?: string }) {
  const [blocked, setBlocked] = useState(false)

  function openPresentation() {
    const presentation = openPresentationWindow(url)
    if (!presentation) {
      setBlocked(true)
      return
    }
    setBlocked(false)
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={className} onClick={openPresentation}>
        {label}
      </button>
      {blocked ? <p role="alert" className="t-small max-w-sm text-gray">Pop-ups für live.weprompt.ch erlauben und nochmals versuchen.</p> : null}
    </div>
  )
}
