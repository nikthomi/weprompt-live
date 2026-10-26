'use client'

import { useSyncExternalStore } from 'react'

/**
 * Anonyme Teilnehmerkennung: eine Zufalls-UUID pro Session, nur im Browser
 * gespeichert. Sie verhindert versehentliche Doppelabgaben, ist aber kein
 * Schutz gegen Absicht (anderer Browser = neue Kennung).
 */
export function participantId(code: string) {
  const key = `wp-live:${code}:pid`
  try {
    const existing = localStorage.getItem(key)
    if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(key, id)
    return id
  } catch {
    // Privater Modus ohne Speicher: Kennung gilt nur für diesen Seitenaufruf.
    return (globalThis as { __wpPid?: string }).__wpPid ??= crypto.randomUUID()
  }
}

const answeredKey = (code: string) => `wp-live:${code}:answers`

type Stored = Record<string, unknown>

function readAnswers(code: string): Stored {
  try {
    const v = JSON.parse(localStorage.getItem(answeredKey(code)) ?? '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

/** Merkt sich die eigene Antwort pro Frage (für Bestätigung und Quiz-Auflösung). */
export function rememberAnswered(code: string, questionId: string, value: unknown = true) {
  try {
    const all = readAnswers(code)
    all[questionId] = value
    const keys = Object.keys(all)
    for (const k of keys.slice(0, Math.max(0, keys.length - 100))) delete all[k]
    localStorage.setItem(answeredKey(code), JSON.stringify(all))
  } catch { /* ohne Speicher reicht die Prüfung auf dem Server */ }
}

export function hasAnswered(code: string, questionId: string) {
  return questionId in readAnswers(code)
}

export function storedAnswer(code: string, questionId: string) {
  return readAnswers(code)[questionId]
}

/** Quiz-Bilanz dieses Geräts: Fragen-ID → richtig beantwortet. */
const scoreKey = (code: string) => `wp-live:${code}:quiz`

export function recordQuizResult(code: string, questionId: string, correct: boolean) {
  try {
    const all = JSON.parse(localStorage.getItem(scoreKey(code)) ?? '{}') as Record<string, boolean>
    if (all[questionId] === correct) return
    all[questionId] = correct
    localStorage.setItem(scoreKey(code), JSON.stringify(all))
  } catch { /* nur Anzeige */ }
}

/** Bilanz aus dem gespeicherten Wert; current zählt die gerade aufgelöste Frage mit. */
export function scoreFrom(raw: string | null, current?: { id: string; correct: boolean }) {
  try {
    const map = JSON.parse(raw ?? '{}') as Record<string, boolean>
    if (current) map[current.id] = current.correct
    const all = Object.values(map)
    return { right: all.filter(Boolean).length, total: all.length }
  } catch {
    return { right: 0, total: 0 }
  }
}

const subscribeStorage = (cb: () => void) => {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

/**
 * Gespeicherte Quiz-Bilanz als Rohtext. Auf dem Server (und beim ersten
 * Rendern im Browser) null, damit die Darstellung beim Laden übereinstimmt.
 */
export function useStoredQuiz(code: string) {
  return useSyncExternalStore(
    subscribeStorage,
    () => { try { return localStorage.getItem(scoreKey(code)) ?? '{}' } catch { return '{}' } },
    () => null,
  )
}
