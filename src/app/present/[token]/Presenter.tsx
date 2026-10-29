'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage } from '@/components/Stage'
import { anonClient } from '@/lib/supabase/browser'
import { throttle, useLiveChannel } from '@/lib/realtime'
import type { PublicState, Snapshot } from '@/lib/types'

/** Beamer-Ansicht: hört auf Zustand und neue Antworten, lädt Ergebnisse gedrosselt nach. */
export function Presenter({ token, initial, joinUrl, joinLabel }: { token: string; initial: Snapshot; joinUrl: string; joinLabel: string }) {
  const [snap, setSnap] = useState(initial)
  const [chrome, setChrome] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const inflight = useRef(false)

  const load = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    try {
      const res = await fetch(`/api/present/${token}`, { cache: 'no-store' })
      if (res.ok) {
        const next = (await res.json()) as Snapshot
        setSnap(prev => (next.version < prev.version ? prev : next))
      }
    } catch { /* nächster Versuch folgt */ } finally {
      inflight.current = false
    }
  }, [token])

  const loadThrottled = useRef<() => void>(() => {})
  useEffect(() => { loadThrottled.current = throttle(load, 800) }, [load])

  const connection = useLiveChannel({
    client: anonClient,
    topics: [`live:${snap.sessionId}`, `live-results:${snap.sessionId}`],
    handlers: {
      // Zustand sofort übernehmen (Frage wechselt ohne Verzögerung), Zahlen nachladen.
      state: payload => {
        const st = payload as PublicState
        setSnap(prev => (st.version < prev.version ? prev : {
          ...prev, ...st,
          ...(st.question?.id !== prev.question?.id ? { results: null, responses: 0 } : {}),
        }))
        load()
      },
      response: () => loadThrottled.current(),
    },
    onResync: load,
    fallbackMs: 3000,
  })

  // Bedienelemente nach drei Sekunden ohne Mausbewegung ausblenden.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const wake = () => { setChrome(true); clearTimeout(t); t = setTimeout(() => setChrome(false), 3000) }
    wake()
    window.addEventListener('mousemove', wake)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'f' || e.key === 'F') toggleFullscreen() }
    window.addEventListener('keydown', onKey)
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])

  return (
    // Ein Klick irgendwo auf den Fernseher genügt für den Vollbildmodus.
    <main className={`fixed inset-0 bg-violett ${chrome ? '' : 'cursor-none'}`}
      onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}) }}>
      <Stage snap={snap} joinUrl={joinUrl} joinLabel={joinLabel} />
      {!fullscreen ? (
        <p className={`t-small pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/35 px-4 py-1.5 text-white transition-opacity duration-500 ${chrome ? 'opacity-100' : 'opacity-0'}`}>
          Einmal klicken für Vollbild
        </p>
      ) : null}
      <div className={`absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 transition-opacity duration-300 ${chrome ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {connection === 'offline' ? <span className="t-small rounded-full bg-white/15 px-3 py-1.5 text-white">Verbindung wird wiederhergestellt …</span> : null}
        <button type="button" className="wp-btn-quiet on-dark" onClick={e => { e.stopPropagation(); toggleFullscreen() }}>
          {fullscreen ? 'Vollbild beenden (F)' : 'Vollbild (F)'}
        </button>
      </div>
    </main>
  )
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.().catch(() => {})
}
