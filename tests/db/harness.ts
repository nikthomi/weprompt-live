import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..', '..')

/** Frische Datenbank mit Supabase-Nachbau und allen Migrationen. */
export async function createDb() {
  const db = new PGlite()
  await db.exec(readFileSync(join(__dirname, 'supabase-stubs.sql'), 'utf8'))
  const dir = join(root, 'supabase', 'migrations')
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'))
  }
  return db
}

export type Db = PGlite
type Rows = Record<string, unknown>[]

/** SQL als Rolle anon/authenticated (wie ein Browser), optional mit Realtime-Topic. */
export async function as(db: Db, authUserId: string | null, sql: string, params: unknown[] = [], topic?: string): Promise<Rows> {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${authUserId ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [authUserId ?? ''])
    if (topic) await tx.query(`select set_config('realtime.topic', $1, true)`, [topic])
    return (await tx.query(sql, params)).rows as Rows
  })
}

/** SQL als Service Role (wie die Server-Routen der App). */
export async function svc(db: Db, sql: string, params: unknown[] = []): Promise<Rows> {
  return db.transaction(async tx => {
    await tx.exec('set local role service_role')
    return (await tx.query(sql, params)).rows as Rows
  })
}

/** SQL mit vollen Rechten (Testaufbau). */
export async function sys(db: Db, sql: string, params: unknown[] = []): Promise<Rows> {
  return (await db.query(sql, params)).rows as Rows
}

export async function makeAdmin(db: Db, email: string, role: 'admin' | 'moderator' = 'moderator') {
  const [u] = await sys(db, `insert into auth.users (email) values ($1) returning id`, [email])
  await sys(db, `insert into live_admins (user_id, email, role) values ($1, $2, $3)`, [u.id, email, role])
  return u.id as string
}

export async function makeUser(db: Db, email: string) {
  const [u] = await sys(db, `insert into auth.users (email) values ($1) returning id`, [email])
  return u.id as string
}

export async function makeSession(db: Db, questions: { type: string; title?: string; config?: object }[] = []) {
  const [s] = await sys(db, `insert into live_sessions (title) values ('KI BASIC – Spiez') returning id, code, present_token`)
  const ids: string[] = []
  for (const [i, q] of questions.entries()) {
    const [row] = await sys(db,
      `insert into live_questions (session_id, position, type, title, config) values ($1, $2, $3, $4, $5) returning id`,
      [s.id, i + 1, q.type, q.title ?? `Frage ${i + 1}`, JSON.stringify(q.config ?? {})])
    ids.push(row.id as string)
  }
  return { id: s.id as string, code: s.code as string, token: s.present_token as string, questions: ids }
}

/** Frage aktivieren und Abstimmung öffnen. */
export async function activate(db: Db, sessionId: string, questionId: string) {
  await sys(db, `update live_sessions set status = 'live', current_question_id = $2, voting_open = true, results_visible = true where id = $1`, [sessionId, questionId])
}

export async function submit(db: Db, questionId: string, participant: string, value: object, clientKey: string | null = null) {
  const [r] = await svc(db, `select live_submit($1, $2, $3, $4) as r`, [questionId, participant, JSON.stringify(value), clientKey])
  return r.r as { ok: boolean; duplicate?: boolean; error?: string }
}

export async function results(db: Db, questionId: string, admin = false) {
  const [r] = await svc(db, `select live_question_results($1, $2) as r`, [questionId, admin])
  return r.r as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
