'use client'

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

const answeredKey = (code: string) => `wp-live:${code}:answered`

export function rememberAnswered(code: string, questionId: string) {
  try {
    const list = JSON.parse(localStorage.getItem(answeredKey(code)) ?? '[]') as string[]
    if (!list.includes(questionId)) localStorage.setItem(answeredKey(code), JSON.stringify([...list, questionId].slice(-100)))
  } catch { /* ohne Speicher reicht die Prüfung auf dem Server */ }
}

export function hasAnswered(code: string, questionId: string) {
  try {
    return (JSON.parse(localStorage.getItem(answeredKey(code)) ?? '[]') as string[]).includes(questionId)
  } catch {
    return false
  }
}
