import { beforeEach, describe, expect, it } from 'vitest'
import { activate, as, createDb, makeAdmin, makeSession, makeUser, results, submit, svc, sys, type Db } from './harness'

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const pid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

let db: Db
beforeEach(async () => { db = await createDb() })

describe('Antworten abgeben', () => {
  it('Multiple Choice: eine Stimme pro Gerät, Wiederholung zählt nicht', async () => {
    const s = await makeSession(db, [{ type: 'choice', config: { options: [{ id: 'a', label: 'Täglich' }, { id: 'b', label: 'Nie' }] } }])
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[0], P1, { options: ['a'] })).toEqual({ ok: true, duplicate: false })
    expect(await submit(db, s.questions[0], P1, { options: ['b'] })).toEqual({ ok: true, duplicate: true })
    expect(await submit(db, s.questions[0], P2, { options: ['b'] })).toEqual({ ok: true, duplicate: false })
    const r = await results(db, s.questions[0])
    expect(r).toMatchObject({ respondents: 2, counts: { a: 1, b: 1 } })
  })

  it('Einfachauswahl lehnt mehrere Optionen und unbekannte IDs ab', async () => {
    const s = await makeSession(db, [{ type: 'choice', config: { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] } }])
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[0], P1, { options: ['a', 'b'] })).toMatchObject({ ok: false, error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { options: ['x'] })).toMatchObject({ ok: false, error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { options: [] })).toMatchObject({ ok: false, error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { text: 'a' })).toMatchObject({ ok: false, error: 'invalid' })
  })

  it('Mehrfachauswahl respektiert maxChoices und zählt pro Person', async () => {
    const options = ['a', 'b', 'c', 'd'].map(id => ({ id, label: id }))
    const s = await makeSession(db, [{ type: 'choice', config: { options, multiple: true, maxChoices: 2 } }])
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[0], P1, { options: ['a', 'b', 'c'] })).toMatchObject({ error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { options: ['a', 'b', 'a'] })).toMatchObject({ ok: true })
    expect(await submit(db, s.questions[0], P2, { options: ['a'] })).toMatchObject({ ok: true })
    expect(await results(db, s.questions[0])).toMatchObject({ respondents: 2, counts: { a: 2, b: 1 } })
  })

  it('Ja/Nein kennt nur yes und no', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }])
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[0], P1, { options: ['vielleicht'] })).toMatchObject({ error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { options: ['yes'] })).toMatchObject({ ok: true })
    expect(await submit(db, s.questions[0], P2, { options: ['no'] })).toMatchObject({ ok: true })
    expect(await results(db, s.questions[0])).toMatchObject({ counts: { yes: 1, no: 1 } })
  })

  it('Skala: nur ganze Zahlen im Bereich, Durchschnitt stimmt', async () => {
    const s = await makeSession(db, [{ type: 'scale', config: { min: 1, max: 5 } }])
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[0], P1, { value: 6 })).toMatchObject({ error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { value: 2.5 })).toMatchObject({ error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { value: '3' })).toMatchObject({ error: 'invalid' })
    await submit(db, s.questions[0], P1, { value: 2 })
    await submit(db, s.questions[0], P2, { value: 5 })
    await submit(db, s.questions[0], pid(3), { value: 5 })
    const r = await results(db, s.questions[0])
    expect(r.respondents).toBe(3)
    expect(r.distribution).toEqual({ 2: 1, 5: 2 })
    expect(Number(r.average)).toBe(4)
  })

  it('Wortwolke: bereinigt, fasst Gross-/Kleinschreibung zusammen, max. Begriffe', async () => {
    const s = await makeSession(db, [{ type: 'wordcloud', config: { maxWords: 2 } }])
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[0], P1, { words: ['a', 'b', 'c'] })).toMatchObject({ error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { words: ['x'.repeat(41)] })).toMatchObject({ error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { words: ['  ', ''] })).toMatchObject({ error: 'invalid' })
    // Doppelte Begriffe einer Person zählen nur einmal.
    expect(await submit(db, s.questions[0], P1, { words: ['  Zukunft ', 'zukunft', 'Chat  GPT'] })).toMatchObject({ ok: true })
    await submit(db, s.questions[0], P2, { words: ['ZUKUNFT'] })
    await submit(db, s.questions[0], pid(3), { words: ['Zukunft'] })
    const r = await results(db, s.questions[0])
    expect(r.words[0]).toMatchObject({ key: 'zukunft', text: 'Zukunft', count: 3 })
    expect(r.words[1]).toMatchObject({ key: 'chat gpt', count: 1 })
  })

  it('Offene Frage: Länge begrenzt, Moderation hält Antworten zurück', async () => {
    const s = await makeSession(db, [
      { type: 'open', config: { maxLength: 50 } },
      { type: 'open', config: { moderation: true } },
    ])
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[0], P1, { text: 'x'.repeat(51) })).toMatchObject({ error: 'invalid' })
    expect(await submit(db, s.questions[0], P1, { text: ' <script>alert(1)</script>\n ' })).toMatchObject({ ok: true })
    const r = await results(db, s.questions[0])
    // Gespeichert wird reiner Text; das Escaping übernimmt die Darstellung.
    expect(r.items[0].text).toBe('<script>alert(1)</script>')

    await activate(db, s.id, s.questions[1])
    await submit(db, s.questions[1], P1, { text: 'Zeit' })
    expect((await results(db, s.questions[1])).items).toHaveLength(0)
    expect((await results(db, s.questions[1], true)).items[0]).toMatchObject({ text: 'Zeit', status: 'pending' })
  })

  it('nur die aktive Frage bei offener Abstimmung nimmt Antworten an', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }, { type: 'yesno' }])
    expect(await submit(db, s.questions[0], P1, { options: ['yes'] })).toMatchObject({ error: 'closed' })
    await activate(db, s.id, s.questions[0])
    expect(await submit(db, s.questions[1], P1, { options: ['yes'] })).toMatchObject({ error: 'closed' })
    await sys(db, `update live_sessions set voting_open = false where id = $1`, [s.id])
    expect(await submit(db, s.questions[0], P1, { options: ['yes'] })).toMatchObject({ error: 'closed' })
    await sys(db, `update live_sessions set voting_open = true where id = $1`, [s.id])
    await sys(db, `update live_questions set enabled = false where id = $1`, [s.questions[0]])
    expect(await submit(db, s.questions[0], P1, { options: ['yes'] })).toMatchObject({ error: 'closed' })
    await sys(db, `update live_sessions set status = 'ended' where id = $1`, [s.id])
    const [st] = await sys(db, `select voting_open, ended_at from live_sessions where id = $1`, [s.id])
    expect(st.voting_open).toBe(false)
    expect(st.ended_at).not.toBeNull()
  })

  it('Rate Limit pro Gerät', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }])
    await activate(db, s.id, s.questions[0])
    const res = []
    for (let i = 0; i < 32; i++) res.push(await submit(db, s.questions[0], P1, { options: ['yes'] }))
    expect(res.filter(r => r.error === 'rate_limited').length).toBe(2)
    expect(await submit(db, s.questions[0], P2, { options: ['yes'] })).toMatchObject({ ok: true })
  })

  it('100 Geräte gleichzeitig: jede Stimme genau einmal', async () => {
    const s = await makeSession(db, [{ type: 'choice', config: { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }] } }])
    await activate(db, s.id, s.questions[0])
    const all = await Promise.all(Array.from({ length: 100 }, (_, i) =>
      submit(db, s.questions[0], pid(i), { options: [['a', 'b', 'c'][i % 3]] }, 'wlan-kursraum')))
    // Jede Person schickt nochmals (Doppelklick, Netzwerk-Wiederholung).
    const again = await Promise.all(Array.from({ length: 100 }, (_, i) =>
      submit(db, s.questions[0], pid(i), { options: ['a'] }, 'wlan-kursraum')))
    expect(all.every(r => r.ok && !r.duplicate)).toBe(true)
    expect(again.every(r => r.ok && r.duplicate)).toBe(true)
    expect(await results(db, s.questions[0])).toMatchObject({ respondents: 100, counts: { a: 34, b: 33, c: 33 } })
  })
})

describe('Beitritt und Zustand', () => {
  it('live_join liefert den öffentlichen Zustand und ob schon beantwortet', async () => {
    const s = await makeSession(db, [{ type: 'yesno', title: 'Hast du heute KI verwendet?' }])
    const [draft] = await svc(db, `select live_join($1, $2) as r`, [s.code.toLowerCase(), P1])
    expect(draft.r).toMatchObject({ status: 'draft', question: null, answered: false })
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { options: ['yes'] })
    const [live] = await svc(db, `select live_join($1, $2) as r`, [s.code, P1])
    expect(live.r).toMatchObject({ status: 'live', votingOpen: true, answered: true, question: { title: 'Hast du heute KI verwendet?', number: 1, total: 1 } })
    const [other] = await svc(db, `select live_join($1, $2) as r`, [s.code, P2])
    expect(other.r).toMatchObject({ answered: false })
    const [none] = await svc(db, `select live_join('ZZZZZZ', $1) as r`, [P1])
    expect(none.r).toBeNull()
  })

  it('Zustandswechsel werden auf dem Session-Kanal gesendet, mit steigender Version', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }, { type: 'scale' }])
    await activate(db, s.id, s.questions[0])
    await sys(db, `update live_sessions set current_question_id = $2 where id = $1`, [s.id, s.questions[1]])
    const msgs = await sys(db, `select payload from realtime.messages where topic = $1 and event = 'state' order by id`, [`live:${s.id}`])
    expect(msgs.length).toBe(2)
    const [a, b] = msgs.map(m => m.payload as { version: number; question: { id: string } })
    expect(b.version).toBeGreaterThan(a.version)
    expect(b.question.id).toBe(s.questions[1])
  })

  it('Antworten lösen nur einen Hinweis auf dem Ergebnis-Kanal aus, ohne Inhalt', async () => {
    const s = await makeSession(db, [{ type: 'open' }])
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { text: 'geheim' })
    const msgs = await sys(db, `select payload from realtime.messages where topic = $1`, [`live-results:${s.id}`])
    expect(msgs).toHaveLength(1)
    expect(JSON.stringify(msgs[0].payload)).not.toContain('geheim')
  })

  it('Beamer sieht Ergebnisse nur, wenn eingeblendet', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }])
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { options: ['yes'] })
    let [p] = await svc(db, `select live_present($1) as r`, [s.token])
    expect(p.r).toMatchObject({ participants: 1, responses: 1, results: { counts: { yes: 1 } } })
    await sys(db, `update live_sessions set results_visible = false where id = $1`, [s.id])
    ;[p] = await svc(db, `select live_present($1) as r`, [s.token])
    expect((p.r as { results: unknown }).results).toBeNull()
    ;[p] = await svc(db, `select live_present('falsch') as r`)
    expect(p.r).toBeNull()
  })

  it('aktuelle Frage muss zur Session gehören', async () => {
    const a = await makeSession(db, [{ type: 'yesno' }])
    const b = await makeSession(db, [{ type: 'yesno' }])
    await expect(sys(db, `update live_sessions set current_question_id = $2 where id = $1`, [a.id, b.questions[0]])).rejects.toThrow()
  })
})

describe('Zugriffsrechte', () => {
  it('anon sieht keine Tabellen und kann keine Funktionen direkt aufrufen', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }])
    await activate(db, s.id, s.questions[0])
    await expect(as(db, null, `select * from live_sessions`)).rejects.toThrow()
    await expect(as(db, null, `select * from live_responses`)).rejects.toThrow()
    await expect(as(db, null, `insert into live_responses (session_id, question_id, participant_id, value) values ($1, $2, $3, '{}')`, [s.id, s.questions[0], P1])).rejects.toThrow()
    await expect(as(db, null, `select live_submit($1, $2, '{"options":["yes"]}')`, [s.questions[0], P1])).rejects.toThrow()
    await expect(as(db, null, `select live_present($1)`, [s.token])).rejects.toThrow()
    await expect(as(db, null, `select live_join($1, $2)`, [s.code, P1])).rejects.toThrow()
  })

  it('eingeloggte Person ohne Admin-Rolle sieht nichts', async () => {
    const user = await makeUser(db, 'teilnehmer@example.ch')
    const s = await makeSession(db, [{ type: 'yesno' }])
    expect(await as(db, user, `select * from live_sessions`)).toHaveLength(0)
    expect(await as(db, user, `update live_sessions set title = 'x' returning id`)).toHaveLength(0)
    await expect(as(db, user, `select live_admin_snapshot($1)`, [s.id])).rejects.toThrow()
    await expect(as(db, user, `insert into live_sessions (title) values ('Fremd')`)).rejects.toThrow()
  })

  it('Moderator verwaltet Sessions und moderiert, darf aber weder löschen noch Team ändern', async () => {
    const mod = await makeAdmin(db, 'mod@weprompt.ch')
    const [created] = await as(db, mod, `insert into live_sessions (title) values ('KI ADVANCED – Bern') returning id, code`)
    expect(created.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    await as(db, mod, `insert into live_questions (session_id, type, title, config) values ($1, 'open', 'Was möchtest du lernen?', '{}')`, [created.id])
    const [q] = await as(db, mod, `select id from live_questions where session_id = $1`, [created.id])
    await as(db, mod, `update live_sessions set status = 'live', current_question_id = $2, voting_open = true where id = $1`, [created.id, q.id])
    await submit(db, q.id as string, P1, { text: 'Prompts' })
    const [resp] = await as(db, mod, `update live_responses set status = 'hidden' returning id`)
    expect(resp).toBeTruthy()
    await expect(as(db, mod, `update live_responses set value = '{"text":"gefälscht"}'`)).rejects.toThrow()
    expect(await as(db, mod, `delete from live_sessions where id = $1 returning id`, [created.id])).toHaveLength(0)
    await expect(as(db, mod, `insert into live_admins (user_id, email) values ($1, 'x@y.ch')`, [mod])).rejects.toThrow()
    const [snap] = await as(db, mod, `select live_admin_snapshot($1) as r`, [created.id])
    expect(snap.r).toMatchObject({ responses: 1, results: { items: [{ status: 'hidden' }] } })
  })

  it('Admin darf Team verwalten und Sessions löschen', async () => {
    const owner = await makeAdmin(db, 'info@deeds.ch', 'admin')
    const other = await makeUser(db, 'neu@weprompt.ch')
    await as(db, owner, `insert into live_admins (user_id, email) values ($1, 'neu@weprompt.ch')`, [other])
    const s = await makeSession(db, [{ type: 'yesno' }])
    expect(await as(db, owner, `delete from live_sessions where id = $1 returning id`, [s.id])).toHaveLength(1)
  })

  it('Realtime: mithören ja, senden nein, nur live-Kanäle', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }])
    await activate(db, s.id, s.questions[0])
    expect((await as(db, null, `select * from realtime.messages`, [], `live:${s.id}`)).length).toBeGreaterThan(0)
    expect(await as(db, null, `select * from realtime.messages`, [], `workshop:${s.id}`)).toHaveLength(0)
    await expect(as(db, null, `insert into realtime.messages (topic, event, payload, private) values ($1, 'state', '{}', true)`, [], `live:${s.id}`)).rejects.toThrow()
  })
})

describe('Admin-Werkzeuge', () => {
  it('Duplizieren kopiert Fragen, nicht Antworten; neuer Code', async () => {
    const admin = await makeAdmin(db, 'mod@weprompt.ch')
    const s = await makeSession(db, [{ type: 'yesno' }, { type: 'scale', config: { min: 1, max: 10 } }])
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { options: ['yes'] })
    const [d] = await as(db, admin, `select live_duplicate_session($1) as id`, [s.id])
    const [copy] = await sys(db, `select * from live_sessions where id = $1`, [d.id])
    expect(copy).toMatchObject({ status: 'draft', title: 'KI BASIC – Spiez (Kopie)' })
    expect(copy.code).not.toBe(s.code)
    const qs = await sys(db, `select type, config from live_questions where session_id = $1 order by position`, [d.id])
    expect(qs.map(q => q.type)).toEqual(['yesno', 'scale'])
    expect(await sys(db, `select * from live_responses where session_id = $1`, [d.id])).toHaveLength(0)
  })

  it('Zurücksetzen löscht Antworten und Teilnehmende', async () => {
    const admin = await makeAdmin(db, 'mod@weprompt.ch')
    const s = await makeSession(db, [{ type: 'yesno' }])
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { options: ['yes'] })
    await as(db, admin, `select live_reset_session($1)`, [s.id])
    expect(await sys(db, `select * from live_responses`)).toHaveLength(0)
    expect(await sys(db, `select * from live_participants`)).toHaveLength(0)
    const [st] = await sys(db, `select status, current_question_id from live_sessions where id = $1`, [s.id])
    expect(st).toMatchObject({ status: 'draft', current_question_id: null })
  })

  it('Neu sortieren in einer Anweisung, Live-Zustand zählt mit', async () => {
    const admin = await makeAdmin(db, 'mod@weprompt.ch')
    const s = await makeSession(db, [{ type: 'yesno' }, { type: 'scale' }, { type: 'open' }])
    await activate(db, s.id, s.questions[0])
    await as(db, admin, `select live_reorder_questions($1, $2)`, [s.id, [s.questions[2], s.questions[1], s.questions[0]]])
    const [st] = await svc(db, `select live_public_state($1) as r`, [s.id])
    expect(st.r).toMatchObject({ question: { id: s.questions[0], number: 3, total: 3 } })
  })

  it('ausgeblendete Wörter verschwinden vom Beamer, bleiben für Admins sichtbar', async () => {
    const s = await makeSession(db, [{ type: 'wordcloud', config: { maxWords: 3 } }])
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { words: ['Zukunft', 'Unsinn'] })
    await sys(db, `insert into live_hidden_words (question_id, word_key) values ($1, 'unsinn')`, [s.questions[0]])
    expect((await results(db, s.questions[0])).words.map((w: { key: string }) => w.key)).toEqual(['zukunft'])
    expect((await results(db, s.questions[0], true)).words).toHaveLength(2)
  })
})
