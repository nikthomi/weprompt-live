// Prüft Quiz und manuelle Wortwolke gegen eine laufende Instanz mit einer
// eigenen Test-Session, die am Ende gelöscht wird.
//   node --env-file=.env.local scripts/e2e-quiz-board.mjs https://live.weprompt.ch
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const base = (process.argv[2] ?? 'http://localhost:3010').replace(/\/+$/, '')
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
let fails = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` (${extra})` : ''}`); if (!ok) fails++ }

const { data: s } = await svc.from('live_sessions').insert({ title: `E2E Quiz/Leinwand ${new Date().toISOString().slice(0, 16)}` }).select('id, code, present_token').single()
const { data: qs } = await svc.from('live_questions').insert([
  { session_id: s.id, position: 1, type: 'quiz', title: 'Foto oder KI?', config: { correct: 'no', seconds: 10 } },
  { session_id: s.id, position: 2, type: 'board', title: 'Chancen und Risiken', config: {} },
]).select('id, type, position')
qs.sort((a, b) => a.position - b.position)
const [quiz, board] = qs
const p1 = randomUUID(), p2 = randomUUID()
const answer = (pid, opt) => fetch(`${base}/api/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: quiz.id, participantId: pid, value: { options: [opt] } }) })

try {
  await svc.from('live_sessions').update({ status: 'live', current_question_id: quiz.id, voting_open: true, results_visible: true }).eq('id', s.id)
  let j = await (await fetch(`${base}/api/join/${s.code}?pid=${p1}`)).json()
  check('Quiz aktiv, Lösung am Handy verborgen', j.question?.type === 'quiz' && j.question.config.correct === undefined)
  const leftS = (j.deadline - j.serverNow) / 1000
  check('Timer serverseitig gestartet', leftS > 8 && leftS <= 10, `${leftS.toFixed(1)} s`)
  check('Antwort 1 angenommen', (await answer(p1, 'no')).status === 200)
  check('Antwort 2 angenommen', (await answer(p2, 'yes')).status === 200)
  let pr = await (await fetch(`${base}/api/present/${s.present_token}`)).json()
  check('Beamer: vor Auflösung keine Zahlen', pr.results === null && pr.responses === 2)
  await svc.from('live_sessions').update({ reveal: true }).eq('id', s.id)
  pr = await (await fetch(`${base}/api/present/${s.present_token}`)).json()
  check('Beamer nach Auflösung: Lösung + Zahlen', pr.question.config.correct === 'no' && pr.results?.counts?.no === 1 && pr.results?.counts?.yes === 1)
  check('Nach Auflösung keine Antwort mehr', (await answer(randomUUID(), 'no')).status === 409)
  j = await (await fetch(`${base}/api/join/${s.code}?pid=${p1}`)).json()
  check('Handy kennt eigene Antwort', j.myAnswer?.options?.[0] === 'no' && j.reveal === true)

  await svc.from('live_sessions').update({ current_question_id: board.id, voting_open: true }).eq('id', s.id)
  await svc.from('live_board_items').insert([
    { question_id: board.id, kind: 'category', text: 'Chancen', x: 0.02, y: 0.05, w: 0.4, h: 0.9 },
    { question_id: board.id, kind: 'word', text: 'Effizienz', x: 0.2, y: 0.4 },
  ])
  pr = await (await fetch(`${base}/api/present/${s.present_token}`)).json()
  check('Beamer zeigt Leinwand', pr.results?.type === 'board' && pr.results.items.length === 2)
  const r = await fetch(`${base}/api/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: board.id, participantId: p1, value: { words: ['x'] } }) })
  check('Leinwand nimmt keine Handy-Antworten', r.status === 400)
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await anon.from('live_board_items').select('id').limit(1)
  check('Leinwand für anonyme Clients gesperrt', Boolean(error))
  const page = await fetch(`${base}/present/${s.present_token}`)
  check('Beamer-Seite lädt', page.status === 200)
} finally {
  await svc.from('live_sessions').delete().eq('id', s.id)
  console.log('Test-Session gelöscht.')
}
process.exit(fails ? 1 : 0)
