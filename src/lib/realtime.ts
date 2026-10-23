'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ConnectionState = 'connecting' | 'live' | 'offline'

type Handlers = Record<string, (payload: unknown) => void>

/**
 * Hört auf einem privaten Realtime-Kanal mit. Nach jedem (Wieder-)Verbinden
 * und beim Zurückkehren in den Tab wird onResync aufgerufen, damit nichts
 * verpasst wird. Solange keine Verbindung besteht, ruft der Hook onResync
 * zusätzlich in festen Abständen auf (Fallback ohne Realtime).
 */
export function useLiveChannel(opts: {
  client: () => SupabaseClient
  topics: string[]
  handlers: Handlers
  onResync: () => void
  fallbackMs?: number
}) {
  const { topics, fallbackMs = 4000 } = opts
  const [state, setState] = useState<ConnectionState>('connecting')
  const latest = useRef(opts)
  useEffect(() => { latest.current = opts })
  const topicKey = topics.join('|')

  useEffect(() => {
    if (!topicKey) return
    const supabase = latest.current.client()
    let cancelled = false
    const channels: ReturnType<SupabaseClient['channel']>[] = []
    const status = new Map<string, string>()

    const update = () => {
      const all = [...status.values()]
      const next: ConnectionState = all.length && all.every(s => s === 'SUBSCRIBED') ? 'live'
        : all.some(s => s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') ? 'offline' : 'connecting'
      setState(prev => {
        if (next === 'live' && prev !== 'live') latest.current.onResync()
        return next
      })
    }

    ;(async () => {
      await supabase.realtime.setAuth()
      if (cancelled) return
      for (const topic of topicKey.split('|')) {
        let ch = supabase.channel(topic, { config: { private: true } })
        for (const event of Object.keys(latest.current.handlers)) {
          ch = ch.on('broadcast', { event }, msg => latest.current.handlers[event]?.(msg.payload))
        }
        ch.subscribe(s => { status.set(topic, s); update() })
        channels.push(ch)
      }
    })()

    const onVisible = () => { if (document.visibilityState === 'visible') latest.current.onResync() }
    const onOnline = () => latest.current.onResync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      for (const ch of channels) supabase.removeChannel(ch)
    }
  }, [topicKey])

  // Fallback: ohne Realtime-Verbindung regelmässig nachfragen.
  useEffect(() => {
    if (state === 'live') return
    const t = setInterval(() => latest.current.onResync(), fallbackMs)
    return () => clearInterval(t)
  }, [state, fallbackMs])

  return state
}

/**
 * Bündelt viele Aufrufe kurz hintereinander: höchstens einer pro intervalMs,
 * der letzte kommt immer an (leading + trailing).
 */
export function throttle(fn: () => void, intervalMs: number) {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  return () => {
    const wait = intervalMs - (Date.now() - last)
    if (wait <= 0) {
      last = Date.now()
      fn()
    } else if (!timer) {
      timer = setTimeout(() => { timer = null; last = Date.now(); fn() }, wait)
    }
  }
}
