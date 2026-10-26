import { notFound } from 'next/navigation'
import { Stage } from '@/components/Stage'
import type { Snapshot } from '@/lib/types'
import { DEMO_BOARD, serverTime } from '../board-demo'

/** Nur in der Entwicklung: alle Bühnen-Zustände mit Beispieldaten, ohne Datenbank. */
export default function Preview() {
  if (process.env.NODE_ENV === 'production') notFound()
  const now = serverTime()
  const base: Omit<Snapshot, 'question' | 'results'> = {
    sessionId: '00000000-0000-4000-8000-000000000000', code: 'K7M2QX', title: 'KI BASIC – Spiez', status: 'live',
    votingOpen: true, resultsVisible: true, showQr: false, reveal: false, deadline: null, serverNow: 0, version: 1, participants: 23, responses: 21,
  }
  const q = (type: Snapshot['question'] extends infer T ? T extends { type: infer U } ? U : never : never, title: string, config = {}) =>
    ({ id: crypto.randomUUID(), type, title, description: null, config, number: 1, total: 4 })
  const words = ['Zukunft', 'ChatGPT', 'Effizienz', 'Neugier', 'Angst', 'Kreativität', 'Datenschutz', 'Automatisierung', 'Prompts', 'Chancen', 'Hilfe', 'Spannend', 'Unsicherheit', 'Werkzeug', 'Lernen', 'Copilot', 'Zeit sparen', 'Ethik']
  const snaps: { label: string; snap: Snapshot }[] = [
    { label: 'Warten / QR', snap: { ...base, question: null, results: null } },
    { label: 'Wortwolke', snap: { ...base, question: q('wordcloud', 'Welches Wort verbindest du mit künstlicher Intelligenz?', { maxWords: 3 }), results: { type: 'wordcloud', respondents: 21, words: words.map((w, i) => ({ key: w.toLowerCase(), text: w, count: Math.max(1, Math.round(14 / (i + 1))), hidden: false })) } } },
    { label: 'Multiple Choice', snap: { ...base, question: q('choice', 'Wie häufig nutzt du ChatGPT?', { options: [{ id: 'a', label: 'Täglich' }, { id: 'b', label: 'Mehrmals pro Woche' }, { id: 'c', label: 'Selten' }, { id: 'd', label: 'Nie' }] }), results: { type: 'choice', respondents: 21, counts: { a: 7, b: 9, c: 4, d: 1 } } } },
    { label: 'Mehrfachauswahl', snap: { ...base, question: q('choice', 'Wofür nutzt du KI heute schon?', { multiple: true, options: [{ id: 'a', label: 'Texte schreiben' }, { id: 'b', label: 'Recherche' }, { id: 'c', label: 'Übersetzen' }] }), results: { type: 'choice', respondents: 21, counts: { a: 15, b: 12, c: 6 } } } },
    { label: 'Ja/Nein', snap: { ...base, question: q('yesno', 'Hast du heute bereits KI verwendet?'), results: { type: 'yesno', respondents: 21, counts: { yes: 13, no: 8 } } } },
    { label: 'Skala', snap: { ...base, question: q('scale', 'Wie sicher fühlst du dich im Umgang mit KI?', { min: 1, max: 5, minLabel: 'unsicher', maxLabel: 'sehr sicher' }), results: { type: 'scale', respondents: 21, distribution: { 1: 2, 2: 5, 3: 8, 4: 4, 5: 2 }, average: 2.95 } } },
    { label: 'Offene Frage', snap: { ...base, question: q('open', 'Was ist deine grösste Herausforderung beim Einsatz von KI?'), results: { type: 'open', respondents: 7, items: ['Die richtigen Prompts finden', 'Datenschutz im Unternehmen klären', 'Zeit, um es auszuprobieren', 'Ich weiss nicht, welchem Tool ich trauen kann', 'Ergebnisse prüfen', 'Team mitnehmen', 'Halluzinationen erkennen und vermeiden, besonders bei Fakten und Zahlen'].map((t, i) => ({ id: String(i), text: t, status: 'visible' as const, at: '' })) } } },
    { label: 'Quiz läuft', snap: { ...base, deadline: now + 14_000, serverNow: now, question: q('quiz', 'Foto oder KI?', { seconds: 20, labels: { yes: 'Echt', no: 'KI' }, imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200' }), results: null } },
    { label: 'Quiz aufgelöst', snap: { ...base, reveal: true, votingOpen: false, question: q('quiz', 'Foto oder KI?', { correct: 'no', seconds: 20, labels: { yes: 'Echt', no: 'KI' }, imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200' }), results: { type: 'quiz', respondents: 21, counts: { yes: 8, no: 13 } } } },
    { label: 'Manuelle Wortwolke', snap: { ...base, question: q('board', 'Wo siehst du Chancen und Risiken von KI?'), results: { type: 'board', respondents: 0, items: DEMO_BOARD } } },
    { label: 'Ergebnisse ausgeblendet', snap: { ...base, resultsVisible: false, question: q('yesno', 'Hast du heute bereits KI verwendet?'), results: null } },
    { label: 'Beendet', snap: { ...base, status: 'ended', question: null, results: null } },
  ]
  return (
    <main className="grid gap-8 bg-mist p-8 xl:grid-cols-2">
      {snaps.map(s => (
        <section key={s.label} id={s.label.replace(/\W+/g, '-').toLowerCase()}>
          <h2 className="t-h3 mb-2">{s.label}</h2>
          <div className="aspect-video w-full overflow-hidden rounded-[14px]">
            <Stage snap={s.snap} joinUrl="https://live.weprompt.ch/join/K7M2QX" joinLabel="live.weprompt.ch/join/K7M2QX" />
          </div>
        </section>
      ))}
    </main>
  )
}
