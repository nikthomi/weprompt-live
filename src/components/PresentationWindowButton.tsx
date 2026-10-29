'use client'

import { useState } from 'react'

const WINDOW_NAME = 'wp-live-present'
const FALLBACK_FEATURES = 'popup=yes,width=1280,height=720,resizable=yes,scrollbars=yes'

// Window Management API (Chrome, Edge, Brave). Noch nicht in den TypeScript-DOM-Typen.
type ScreenInfo = { availLeft: number; availTop: number; availWidth: number; availHeight: number; isPrimary: boolean; label?: string }
type ScreenDetails = { screens: ScreenInfo[]; currentScreen: ScreenInfo }
type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> }

export type OpenResult =
  | { status: 'external'; screen: string } // auf dem zweiten Bildschirm geöffnet
  | { status: 'single' } // nur ein Bildschirm erkannt (oder gespiegelt)
  | { status: 'unsupported' } // Browser kann Bildschirme nicht abfragen
  | { status: 'denied' } // Erlaubnis für Bildschirme verweigert
  | { status: 'retry' } // Erlaubnis gerade erteilt, Pop-up dadurch blockiert
  | { status: 'blocked' } // Pop-ups blockiert

/** Bildschirme abfragen. Fragt beim ersten Mal um Erlaubnis. */
async function otherScreen(): Promise<{ screen: ScreenInfo | null; status?: 'unsupported' | 'denied' | 'single'; asked: boolean }> {
  const w = window as WindowWithScreens
  if (!('getScreenDetails' in w) || !w.getScreenDetails) {
    return { screen: null, status: w.screen && (w.screen as Screen & { isExtended?: boolean }).isExtended === false ? 'single' : 'unsupported', asked: false }
  }
  let asked = false
  try {
    const perm = await navigator.permissions.query({ name: 'window-management' as PermissionName })
    if (perm.state === 'denied') return { screen: null, status: 'denied', asked }
    asked = perm.state === 'prompt'
  } catch { /* ältere Chrome-Versionen kennen den Namen nicht */ }
  try {
    const details = await w.getScreenDetails()
    const others = details.screens.filter(s => s !== details.currentScreen)
    if (!others.length) return { screen: null, status: 'single', asked }
    // Den grössten anderen Bildschirm nehmen (meist der Fernseher oder Beamer).
    const screen = others.sort((a, b) => b.availWidth * b.availHeight - a.availWidth * a.availHeight)[0]
    return { screen, asked }
  } catch {
    return { screen: null, status: 'denied', asked }
  }
}

/**
 * Öffnet die Beamer-Ansicht. Mit zweitem Bildschirm (Fernseher, Beamer) dort,
 * bildschirmfüllend; sonst als normales Fenster auf dem Laptop.
 */
export async function openPresentationWindow(url: string): Promise<{ window: Window | null; result: OpenResult }> {
  const found = await otherScreen()
  if (found.screen) {
    const s = found.screen
    const features = `popup=yes,left=${s.availLeft},top=${s.availTop},width=${s.availWidth},height=${s.availHeight}`
    const win = window.open(url, WINDOW_NAME, features)
    if (!win) return { window: null, result: { status: found.asked ? 'retry' : 'blocked' } }
    // War das Fenster schon offen, bleibt es sonst auf dem alten Bildschirm.
    try {
      win.moveTo(s.availLeft, s.availTop)
      win.resizeTo(s.availWidth, s.availHeight)
    } catch { /* nicht schlimm */ }
    win.focus()
    return { window: win, result: { status: 'external', screen: s.label || 'zweiter Bildschirm' } }
  }
  const win = window.open(url, WINDOW_NAME, FALLBACK_FEATURES)
  if (!win) return { window: null, result: { status: found.asked ? 'retry' : 'blocked' } }
  win.focus()
  return { window: win, result: { status: found.status ?? 'unsupported' } }
}

export const OPEN_HINT: Record<OpenResult['status'], string | null> = {
  external: 'Präsentation läuft auf dem zweiten Bildschirm. Einmal dort hinklicken für Vollbild.',
  single: 'Kein zweiter Bildschirm erkannt. Ist der Fernseher als erweiterter Bildschirm eingestellt (nicht gespiegelt)? Sonst das Fenster hinüberziehen und dort einmal klicken.',
  unsupported: 'Dieser Browser kann die Präsentation nicht selbst auf den Fernseher legen. Fenster hinüberziehen und dort einmal klicken für Vollbild – oder Chrome, Edge oder Brave verwenden.',
  denied: 'Der Browser darf die Bildschirme nicht abfragen. In den Website-Einstellungen von live.weprompt.ch «Fensterverwaltung» erlauben, oder das Fenster hinüberziehen.',
  retry: 'Danke für die Erlaubnis. Bitte nochmals klicken, dann öffnet sich die Präsentation auf dem Fernseher.',
  blocked: 'Pop-ups für live.weprompt.ch erlauben und nochmals versuchen.',
}

/** Öffnet oder fokussiert die Beamer-Ansicht in einem eigenen Browserfenster. */
export function PresentationWindowButton({ url, label = 'Präsentationsfenster öffnen', className = 'wp-btn-quiet' }: { url: string; label?: string; className?: string }) {
  const [hint, setHint] = useState<string | null>(null)

  async function openPresentation() {
    const { result } = await openPresentationWindow(url)
    setHint(OPEN_HINT[result.status])
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={className} onClick={openPresentation}>
        {label}
      </button>
      {hint ? <p role="status" className="t-small max-w-sm text-gray">{hint}</p> : null}
    </div>
  )
}
