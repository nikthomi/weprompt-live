'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { openPresentationWindow } from './PresentationWindowButton'

export function LiveControlLauncher({ href, presentationUrl, className }: { href: string; presentationUrl: string; className: string }) {
  const router = useRouter()
  const [blocked, setBlocked] = useState(false)

  function launch() {
    const presentation = openPresentationWindow(presentationUrl)
    if (!presentation) {
      setBlocked(true)
      return
    }
    setBlocked(false)
    router.push(href)
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={className} onClick={launch}>Live steuern</button>
      {blocked ? <p role="alert" className="t-small max-w-sm text-gray">Pop-ups für live.weprompt.ch erlauben und nochmals versuchen.</p> : null}
    </div>
  )
}
