// Lasttest: simuliert N Teilnehmende gegen eine laufende Instanz.
//
//   npm run loadtest -- http://localhost:3010 100
//   npm run loadtest -- https://live.weprompt.ch 100
//
// Ablauf: Test-Session mit vier Fragen anlegen (Service Role), N Geräte treten
// über /api/join bei und abonnieren den Realtime-Kanal wie echte Handys. Pro
// Frage: aktivieren, messen bis alle N die Meldung haben, alle antworten
// gleichzeitig über /api/answer, jede Person sendet nochmals (Doppelklick),
// dann wird das Ergebnis in der Datenbank nachgezählt. Am Ende wird die
// Test-Session gelöscht.
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const base = (process.argv[2] ?? 'http://localhost:3010').replace(/\/+$/, '')
const N = Number(process.argv[3] ?? 100)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const ms = t => `${Math.round(t)} ms`
const pctl = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] }
const stats = arr => `median ${ms(pctl(arr, 50))}, p95 ${ms(pctl(arr, 95))}, max ${ms(Math.max(...arr))}`

const { data: session, error } = await svc.from('live_sessions').insert({ title: `Lasttest ${new Date().toISOString().slice(0, 16)}` }).select('id, code').single()
if (error) throw error
const questions = [
  { type: 'choice', title: 'Wie häufig nutzt du ChatGPT?', config: { options: ['a', 'b', 'c', 'd'].map(id => ({ id, label: id })) } },
  { type: 'wordcloud', title: 'Was verbindest du mit KI?', config: { maxWords: 3 } },
  { type: 'scale', title: 'Wie sicher fühlst du dich?', config: { min: 1, max: 10 } },
  { type: 'open', title: 'Was möchtest du lernen?', config: { maxLength: 200 } },
]
const { data: qs, error: qErr } = await svc.from('live_questions').insert(questions.map((q, i) => ({ ...q, session_id: session.id, position: i + 1 }))).select('id, type, position')
if (qErr) { await svc.from('live_sessions').delete().eq('id', session.id); throw qErr }
qs.sort((a, b) => a.position - b.position)
console.log(`Session ${session.code} mit ${qs.length} Fragen, ${N} Teilnehmende gegen ${base}\n`)

const report = { joins: [], subscribe: null, rounds: [] }
let failures = 0

try {
  // ── Beitritt ──────────────────────────────────────────────────────────────
  const people = Array.from({ length: N }, () => ({ pid: randomUUID(), got: new Map() }))
  let t0 = performance.now()
  await Promise.all(people.map(async p => {
    const s = performance.now()
    const res = await fetch(`${base}/api/join/${session.code}?pid=${p.pid}`)
    if (!res.ok) failures++
    report.joins.push(performance.now() - s)
  }))
  console.log(`Beitritt: ${N} Anfragen in ${ms(performance.now() - t0)} (${stats(report.joins)}), Fehler: ${failures}`)

  // ── Realtime: jedes Gerät eine eigene Verbindung ─────────────────────────
  t0 = performance.now()
  const clients = await Promise.all(people.map(p => new Promise((resolve, reject) => {
    const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const ch = c.channel(`live:${session.id}`, { config: { private: true } })
    ch.on('broadcast', { event: 'state' }, m => { const id = m.payload.question?.id; if (id && !p.got.has(id)) p.got.set(id, performance.now()) })
    ch.subscribe(s => {
      if (s === 'SUBSCRIBED') resolve(c)
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') reject(new Error(`Realtime: ${s}`))
    })
  })))
  report.subscribe = performance.now() - t0
  console.log(`Realtime: ${clients.length} Verbindungen in ${ms(report.subscribe)} aufgebaut\n`)

  // ── Pro Frage ─────────────────────────────────────────────────────────────
  await svc.from('live_sessions').update({ status: 'live' }).eq('id', session.id)
  for (const q of qs) {
    const sent = performance.now()
    await svc.from('live_sessions').update({ current_question_id: q.id, voting_open: true, results_visible: true }).eq('id', session.id)
    // Warten, bis alle die Meldung haben (höchstens 10 s).
    while (people.some(p => !p.got.has(q.id)) && performance.now() - sent < 10_000) await new Promise(r => setTimeout(r, 20))
    const arrived = people.filter(p => p.got.has(q.id)).map(p => p.got.get(q.id) - sent)

    const value = i => q.type === 'choice' ? { options: [['a', 'b', 'c', 'd'][i % 4]] }
      : q.type === 'wordcloud' ? { words: [['Zukunft', 'Effizienz', 'Neugier', 'ChatGPT', 'Angst'][i % 5], `Wort${i % 7}`] }
      : q.type === 'scale' ? { value: 1 + (i % 10) }
      : { text: `Antwort Nummer ${i} <b>mit HTML</b>` }

    const lat = []
    const statuses = {}
    const post = async (p, i) => {
      const s = performance.now()
      const res = await fetch(`${base}/api/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: q.id, participantId: p.pid, value: value(i) }) })
      const body = await res.json().catch(() => ({}))
      lat.push(performance.now() - s)
      const key = `${res.status}${body.duplicate ? ' (doppelt)' : ''}`
      statuses[key] = (statuses[key] ?? 0) + 1
    }
    const t1 = performance.now()
    await Promise.all(people.map(post))
    const burst = performance.now() - t1
    await Promise.all(people.map(post)) // zweiter Versuch jeder Person

    const { data: r } = await svc.rpc('live_question_results', { p_question_id: q.id, p_admin: true })
    const ok = r.respondents === N
    if (!ok) failures++
    report.rounds.push({ type: q.type, delivered: arrived.length, arrived, lat, burst, statuses, respondents: r.respondents })
    console.log(`Frage «${q.type}»`)
    console.log(`  Frage an Handys: ${arrived.length}/${N} erhalten, ${arrived.length ? stats(arrived) : '–'}`)
    console.log(`  ${N} gleichzeitige Antworten in ${ms(burst)} (${stats(lat.slice(0, N))})`)
    console.log(`  Antwortcodes inkl. Wiederholung: ${JSON.stringify(statuses)}`)
    console.log(`  Gezählt in der Datenbank: ${r.respondents} ${ok ? '✓' : '✗ erwartet ' + N}`)
    if (q.type === 'choice') console.log(`  Verteilung: ${JSON.stringify(r.counts)}`)
    if (q.type === 'scale') console.log(`  Durchschnitt: ${r.average}`)
    if (q.type === 'wordcloud') console.log(`  Top-Begriffe: ${r.words.slice(0, 5).map(w => `${w.text} ${w.count}`).join(', ')}`)
  }

  // Geschlossene Abstimmung nimmt nichts mehr an.
  await svc.from('live_sessions').update({ voting_open: false }).eq('id', session.id)
  const late = await fetch(`${base}/api/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: qs.at(-1).id, participantId: randomUUID(), value: { text: 'zu spät' } }) })
  console.log(`\nAntwort nach dem Schliessen: HTTP ${late.status} ${late.status === 409 ? '✓' : '✗'}`)
  if (late.status !== 409) failures++

  for (const c of clients) c.removeAllChannels()
} finally {
  await svc.from('live_sessions').delete().eq('id', session.id)
  console.log('Test-Session gelöscht.')
}

console.log(failures ? `\n✗ ${failures} Abweichung(en)` : '\n✓ Alle Prüfungen bestanden')
process.exit(failures ? 1 : 0)
