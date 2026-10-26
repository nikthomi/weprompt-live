import { beforeEach, describe, expect, it } from 'vitest'
import { activate, as, createDb, makeAdmin, makeSession, results, submit, svc, sys, type Db } from './harness'

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'

let db: Db
beforeEach(async () => { db = await createDb() })

const state = async (sessionId: string) => (await svc(db, `select live_public_state($1) as r`, [sessionId]))[0].r as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

describe('Quiz Richtig/Falsch', () => {
  it('verbirgt die richtige Antwort bis zur Auflösung', async () => {
    const s = await makeSession(db, [{ type: 'quiz', title: 'Foto oder KI?', config: { correct: 'no', seconds: 20 } }])
    await activate(db, s.id, s.questions[0])
    let st = await state(s.id)
    expect(st.question.config.correct).toBeUndefined()
    expect(st.question.config.seconds).toBe(20)
    expect(st.reveal).toBe(false)
    const msgs = await sys(db, `select payload::text as p from realtime.messages where topic = $1`, [`live:${s.id}`])
    expect(msgs.every(m => !(m.p as string).includes('"correct"'))).toBe(true)

    await sys(db, `update live_sessions set reveal = true where id = $1`, [s.id])
    st = await state(s.id)
    expect(st.question.config.correct).toBe('no')
    expect(st.votingOpen).toBe(false)
  })

  it('startet den Timer serverseitig und lehnt späte Antworten ab', async () => {
    const s = await makeSession(db, [{ type: 'quiz', config: { correct: 'yes', seconds: 20 } }])
    await activate(db, s.id, s.questions[0])
    const [row] = await sys(db, `select voting_deadline > now() + interval '19 seconds' as ok from live_sessions where id = $1`, [s.id])
    expect(row.ok).toBe(true)
    expect(await submit(db, s.questions[0], P1, { options: ['yes'] })).toMatchObject({ ok: true })
    await sys(db, `update live_sessions set voting_deadline = now() - interval '1 second' where id = $1`, [s.id])
    expect(await submit(db, s.questions[0], P2, { options: ['no'] })).toMatchObject({ error: 'closed' })
    expect((await state(s.id)).votingOpen).toBe(false)
  })

  it('nach der Auflösung keine Antworten mehr; erneutes Öffnen startet neu', async () => {
    const s = await makeSession(db, [{ type: 'quiz', config: { correct: 'yes', seconds: 0 } }])
    await activate(db, s.id, s.questions[0])
    expect((await sys(db, `select voting_deadline from live_sessions where id = $1`, [s.id]))[0].voting_deadline).toBeNull()
    await sys(db, `update live_sessions set reveal = true where id = $1`, [s.id])
    expect(await submit(db, s.questions[0], P1, { options: ['yes'] })).toMatchObject({ error: 'closed' })
    await sys(db, `update live_sessions set voting_open = true where id = $1`, [s.id])
    expect((await state(s.id)).reveal).toBe(false)
    expect(await submit(db, s.questions[0], P1, { options: ['yes'] })).toMatchObject({ ok: true })
  })

  it('Beamer sieht Zahlen erst nach der Auflösung; Handy kennt die eigene Antwort', async () => {
    const s = await makeSession(db, [{ type: 'quiz', config: { correct: 'yes', seconds: 30 } }])
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { options: ['no'] })
    await submit(db, s.questions[0], P2, { options: ['yes'] })
    let [p] = await svc(db, `select live_present($1) as r`, [s.token])
    expect((p.r as { results: unknown }).results).toBeNull()
    expect(p.r).toMatchObject({ responses: 2 })
    const [j] = await svc(db, `select live_join($1, $2) as r`, [s.code, P1])
    expect(j.r).toMatchObject({ answered: true, myAnswer: { options: ['no'] } })
    await sys(db, `update live_sessions set reveal = true where id = $1`, [s.id])
    ;[p] = await svc(db, `select live_present($1) as r`, [s.token])
    expect(p.r).toMatchObject({ results: { type: 'quiz', counts: { yes: 1, no: 1 } }, question: { config: { correct: 'yes' } } })
  })

  it('Admin-Vorschau kennt die Lösung schon vorher', async () => {
    const admin = await makeAdmin(db, 'info@weprompt.ch', 'admin')
    const s = await makeSession(db, [{ type: 'quiz', config: { correct: 'no', seconds: 10 } }])
    await activate(db, s.id, s.questions[0])
    const [snap] = await as(db, admin, `select live_admin_snapshot($1) as r`, [s.id])
    expect(snap.r).toMatchObject({ reveal: false, question: { config: { correct: 'no' } } })
  })
})

describe('Manuelle Wortwolke', () => {
  it('nimmt keine Antworten von Handys an', async () => {
    const s = await makeSession(db, [{ type: 'board' }])
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[0], P1, { words: ['Hallo'] })).toMatchObject({ error: 'invalid' })
  })

  it('Admins legen Begriffe und Kategorien an; Beamer sieht sie immer', async () => {
    const admin = await makeAdmin(db, 'info@weprompt.ch', 'admin')
    const s = await makeSession(db, [{ type: 'board' }])
    await as(db, admin, `insert into live_board_items (question_id, kind, text, x, y, w, h) values ($1, 'category', 'Chancen', 0.05, 0.1, 0.4, 0.8)`, [s.questions[0]])
    await as(db, admin, `insert into live_board_items (question_id, kind, text, x, y) values ($1, 'word', 'Effizienz', 0.2, 0.3)`, [s.questions[0]])
    await sys(db, `update live_sessions set status = 'live', current_question_id = $2, results_visible = false where id = $1`, [s.id, s.questions[0]])
    const [p] = await svc(db, `select live_present($1) as r`, [s.token])
    const items = (p.r as { results: { items: { kind: string; text: string }[] } }).results.items
    expect(items.map(i => i.text)).toEqual(['Effizienz', 'Chancen'])
    const pings = await sys(db, `select * from realtime.messages where topic = $1`, [`live-results:${s.id}`])
    expect(pings.length).toBe(2)
  })

  it('anon und Nicht-Admins können die Leinwand weder lesen noch ändern', async () => {
    const s = await makeSession(db, [{ type: 'board' }])
    await expect(as(db, null, `select * from live_board_items`)).rejects.toThrow()
    await expect(as(db, null, `insert into live_board_items (question_id, kind, text) values ($1, 'word', 'x')`, [s.questions[0]])).rejects.toThrow()
    const [u] = await sys(db, `insert into auth.users (email) values ('x@y.ch') returning id`)
    await expect(as(db, u.id as string, `insert into live_board_items (question_id, kind, text) values ($1, 'word', 'x')`, [s.questions[0]])).rejects.toThrow()
  })

  it('Koordinaten bleiben auf der Fläche', async () => {
    const s = await makeSession(db, [{ type: 'board' }])
    await expect(sys(db, `insert into live_board_items (question_id, kind, text, x) values ($1, 'word', 'x', 1.5)`, [s.questions[0]])).rejects.toThrow()
  })

  it('Duplizieren übernimmt die Leinwand, Zurücksetzen behält nur Kategorien', async () => {
    const admin = await makeAdmin(db, 'info@weprompt.ch', 'admin')
    const s = await makeSession(db, [{ type: 'board' }])
    await sys(db, `insert into live_board_items (question_id, kind, text, w, h) values ($1, 'category', 'Risiken', 0.3, 0.3), ($1, 'word', 'Datenschutz', null, null)`, [s.questions[0]])
    const [d] = await as(db, admin, `select live_duplicate_session($1) as id`, [s.id])
    const copied = await sys(db, `select b.text from live_board_items b join live_questions q on q.id = b.question_id where q.session_id = $1 order by b.text`, [d.id])
    expect(copied.map(r => r.text)).toEqual(['Datenschutz', 'Risiken'])
    await as(db, admin, `select live_reset_session($1)`, [s.id])
    const left = await sys(db, `select text from live_board_items where question_id = $1`, [s.questions[0]])
    expect(left.map(r => r.text)).toEqual(['Risiken'])
  })

  it('Ergebnisse alter Fragetypen bleiben unverändert', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }])
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { options: ['yes'] })
    expect(await results(db, s.questions[0])).toMatchObject({ counts: { yes: 1 } })
  })
})
