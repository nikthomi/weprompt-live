import { beforeEach, describe, expect, it } from 'vitest'
import { activate, createDb, makeSession, submit, svc, sys, type Db } from './harness'

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const P3 = '33333333-3333-4333-8333-333333333333'

let db: Db
beforeEach(async () => { db = await createDb() })

type J = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const profile = async (code: string, pid: string, name: string, avatar: string) =>
  (await svc(db, `select live_set_profile($1, $2, $3, $4) as r`, [code, pid, name, avatar]))[0].r as J
const join = async (code: string, pid: string | null) => (await svc(db, `select live_join($1, $2) as r`, [code, pid]))[0].r as J
const snapshot = async (id: string) => (await svc(db, `select live_snapshot($1, false) as r`, [id]))[0].r as J

const quiz = (correct: string, seconds = 0) => ({ type: 'quiz', config: { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correct, seconds } })

describe('Name und Avatar', () => {
  it('speichert Name und Avatar und gibt sie beim Beitritt zurück', async () => {
    const s = await makeSession(db, [quiz('a')])
    expect(await profile(s.code, P1, '  Anna  ', 'fuchs')).toMatchObject({ ok: true, name: 'Anna', avatar: 'fuchs' })
    const j = await join(s.code, P1)
    expect(j.profile).toEqual({ name: 'Anna', avatar: 'fuchs' })
    expect(j.hasQuiz).toBe(true)
    expect((await join(s.code, P2)).profile).toBeNull()
  })

  it('lehnt leere, zu lange Namen und unbekannte Avatare ab', async () => {
    const s = await makeSession(db, [quiz('a')])
    expect(await profile(s.code, P1, '   ', 'kuh')).toMatchObject({ ok: false, error: 'invalid' })
    expect(await profile(s.code, P1, 'x'.repeat(21), 'kuh')).toMatchObject({ ok: false, error: 'invalid' })
    expect(await profile(s.code, P1, 'Anna', 'drache')).toMatchObject({ ok: false, error: 'invalid' })
    expect(await profile('ZZZZZZ', P1, 'Anna', 'kuh')).toMatchObject({ ok: false, error: 'not_found' })
  })

  it('zeigt die Avatare im Warteraum auf dem Beamer', async () => {
    const s = await makeSession(db, [quiz('a')])
    await sys(db, `update live_sessions set status = 'live' where id = $1`, [s.id])
    await profile(s.code, P1, 'Anna', 'fuchs')
    await profile(s.code, P2, 'Ben', 'eule')
    const snap = await snapshot(s.id)
    expect(snap.lobby).toEqual([{ name: 'Anna', avatar: 'fuchs' }, { name: 'Ben', avatar: 'eule' }])
  })

  it('Sessions ohne Quiz brauchen kein Profil', async () => {
    const s = await makeSession(db, [{ type: 'yesno' }])
    expect((await join(s.code, P1)).hasQuiz).toBe(false)
    await sys(db, `update live_sessions set status = 'live' where id = $1`, [s.id])
    expect((await snapshot(s.id)).lobby).toBeNull()
  })
})

describe('Punkte und Podest', () => {
  it('zählt richtige Antworten, gibt Tempo-Bonus und teilt Plätze bei Gleichstand', async () => {
    const s = await makeSession(db, [quiz('a', 20), quiz('b')])
    for (const [p, n, a] of [[P1, 'Anna', 'fuchs'], [P2, 'Ben', 'eule'], [P3, 'Cleo', 'kuh']]) await profile(s.code, p, n, a)

    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { options: ['a'] })
    await submit(db, s.questions[0], P2, { options: ['b'] })
    await submit(db, s.questions[0], P3, { options: ['a'] })
    // Cleo antwortet «später»: Restzeit von Hand halbieren.
    await sys(db, `update live_responses set speed = 0.5 where participant_id = $1`, [P3])

    await activate(db, s.id, s.questions[1])
    await submit(db, s.questions[1], P1, { options: ['b'] }) // ohne Timer: volle 1000
    await submit(db, s.questions[1], P2, { options: ['b'] })
    await submit(db, s.questions[1], P3, { options: ['a'] })

    await sys(db, `update live_sessions set leaderboard = true where id = $1`, [s.id])
    const snap = await snapshot(s.id)
    expect(snap.leaderboard).toBe(true)
    expect(snap.votingOpen).toBe(false)
    const top = snap.ranking.top as J[]
    expect(snap.ranking).toMatchObject({ total: 2, players: 3 })
    expect(top[0]).toMatchObject({ rank: 1, name: 'Anna', correct: 2 })
    expect(top[0].points).toBeGreaterThan(1900)
    expect(top.map(t => t.name)).toEqual(['Anna', 'Ben', 'Cleo'])
    expect(top[1]).toMatchObject({ rank: 2, points: 1000, correct: 1 })
    expect(top[2]).toMatchObject({ rank: 3, points: 750, correct: 1 })

    const me = (await join(s.code, P3)).me
    expect(me).toMatchObject({ rank: 3, points: 750, correct: 1, players: 3 })
  })

  it('gleiche Punktzahl teilt sich den Platz', async () => {
    const s = await makeSession(db, [quiz('a')])
    await activate(db, s.id, s.questions[0])
    await submit(db, s.questions[0], P1, { options: ['a'] })
    await submit(db, s.questions[0], P2, { options: ['a'] })
    await submit(db, s.questions[0], P3, { options: ['b'] })
    await sys(db, `update live_sessions set leaderboard = true where id = $1`, [s.id])
    const top = (await snapshot(s.id)).ranking.top as J[]
    expect(top.map(t => t.rank)).toEqual([1, 1, 3])
    expect(top[2].name).toBe('Anonym')
  })

  it('während der Auswertung zählen keine Antworten, eine neue Frage blendet das Podest aus', async () => {
    const s = await makeSession(db, [quiz('a'), quiz('b')])
    await activate(db, s.id, s.questions[0])
    await sys(db, `update live_sessions set leaderboard = true, voting_open = true where id = $1`, [s.id])
    expect(await submit(db, s.questions[0], P1, { options: ['a'] })).toMatchObject({ ok: false, error: 'closed' })
    await activate(db, s.id, s.questions[1])
    expect((await snapshot(s.id)).leaderboard).toBe(false)
    expect((await snapshot(s.id)).ranking).toBeNull()
  })

  it('der Beamer sieht keine richtige Antwort über die Rangliste vor der Auflösung', async () => {
    const s = await makeSession(db, [quiz('a', 20)])
    await activate(db, s.id, s.questions[0])
    const snap = await snapshot(s.id)
    expect(snap.ranking).toBeNull()
    expect(snap.question.config.correct).toBeUndefined()
  })
})
