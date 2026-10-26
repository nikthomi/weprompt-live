'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { assertAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { QuestionInput, parseConfig } from '@/lib/question-schema'
import { defaultConfig, type QuestionType } from '@/lib/types'

export type ActionResult = { error?: string; ok?: boolean; id?: string }

const SessionInput = z.object({
  title: z.string().trim().min(1, 'Bitte einen Titel eingeben.').max(160, 'Der Titel ist zu lang.'),
  description: z.string().trim().max(2000).optional().transform(v => v || null),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).transform(v => v || null),
  auto_show_results: z.boolean().optional(),
})

function message(e: unknown) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? 'Ungültige Eingabe.'
  if (e instanceof Error) return e.message
  return 'Das hat nicht geklappt.'
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const { supabase, authId } = await assertAdmin()
  let input: z.infer<typeof SessionInput>
  try {
    input = SessionInput.parse({ title: form.get('title'), event_date: form.get('event_date') ?? '' })
  } catch (e) {
    return { error: message(e) }
  }
  const { data, error } = await supabase.from('live_sessions').insert({ ...input, created_by: authId }).select('id').single()
  if (error) return { error: 'Die Session konnte nicht angelegt werden.' }
  redirect(`/admin/sessions/${data.id}`)
}

export async function updateSession(id: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin()
  try {
    const input = SessionInput.parse({
      title: form.get('title'),
      description: form.get('description') ?? '',
      event_date: form.get('event_date') ?? '',
      auto_show_results: form.get('auto_show_results') === 'on',
    })
    const { error } = await supabase.from('live_sessions').update(input).eq('id', id)
    if (error) throw new Error('Speichern fehlgeschlagen.')
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath(`/admin/sessions/${id}`)
  revalidatePath('/admin')
  return { ok: true }
}

export async function duplicateSession(id: string) {
  const { supabase } = await assertAdmin()
  const { data, error } = await supabase.rpc('live_duplicate_session', { p_session_id: id })
  if (error || !data) throw new Error('Duplizieren fehlgeschlagen.')
  redirect(`/admin/sessions/${data}`)
}

export async function setArchived(id: string, archived: boolean) {
  const { supabase } = await assertAdmin()
  const { data: s } = await supabase.from('live_sessions').select('started_at').eq('id', id).single()
  await supabase.from('live_sessions').update({ status: archived ? 'archived' : (s?.started_at ? 'ended' : 'draft') }).eq('id', id)
  revalidatePath('/admin')
  revalidatePath(`/admin/sessions/${id}`)
}

export async function resetSession(id: string) {
  const { supabase } = await assertAdmin()
  const { error } = await supabase.rpc('live_reset_session', { p_session_id: id })
  if (error) throw new Error('Zurücksetzen fehlgeschlagen.')
  revalidatePath(`/admin/sessions/${id}`)
  revalidatePath('/admin')
}

export async function deleteSession(id: string) {
  const { supabase, admin } = await assertAdmin()
  if (admin.role !== 'admin') throw new Error('Nur Admins können Sessions löschen.')
  await supabase.from('live_sessions').delete().eq('id', id)
  revalidatePath('/admin')
  redirect('/admin')
}

// ── Fragen ──────────────────────────────────────────────────────────────────

export async function addQuestion(sessionId: string, type: QuestionType): Promise<ActionResult> {
  const { supabase } = await assertAdmin()
  const { data: last } = await supabase.from('live_questions').select('position').eq('session_id', sessionId)
    .order('position', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await supabase.from('live_questions').insert({
    session_id: sessionId,
    position: (last?.position ?? 0) + 1,
    type,
    title: 'Neue Frage',
    config: defaultConfig(type),
  }).select('id').single()
  if (error) return { error: 'Die Frage konnte nicht angelegt werden.' }
  revalidatePath(`/admin/sessions/${sessionId}`)
  return { ok: true, id: data.id }
}

export async function saveQuestion(id: string, raw: { type: QuestionType; title: string; description: string; config: unknown; enabled?: boolean }): Promise<ActionResult> {
  const { supabase } = await assertAdmin()
  try {
    const input = QuestionInput.parse(raw)
    const config = parseConfig(input.type, input.config)
    const { data, error } = await supabase.from('live_questions')
      .update({ title: input.title, description: input.description, config, ...(raw.enabled === undefined ? {} : { enabled: raw.enabled }) })
      .eq('id', id).select('session_id').single()
    if (error) throw new Error('Speichern fehlgeschlagen.')
    revalidatePath(`/admin/sessions/${data.session_id}`)
    return { ok: true }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function setQuestionEnabled(id: string, enabled: boolean) {
  const { supabase } = await assertAdmin()
  const { data } = await supabase.from('live_questions').update({ enabled }).eq('id', id).select('session_id').single()
  if (data) revalidatePath(`/admin/sessions/${data.session_id}`)
}

export async function deleteQuestion(id: string) {
  const { supabase } = await assertAdmin()
  const { data } = await supabase.from('live_questions').delete().eq('id', id).select('session_id').single()
  if (data) revalidatePath(`/admin/sessions/${data.session_id}`)
}

export async function reorderQuestions(sessionId: string, ids: string[]) {
  const { supabase } = await assertAdmin()
  z.array(z.uuid()).max(200).parse(ids)
  await supabase.rpc('live_reorder_questions', { p_session_id: sessionId, p_ids: ids })
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// ── Team ────────────────────────────────────────────────────────────────────

async function assertOwner() {
  const viewer = await assertAdmin()
  if (viewer.admin.role !== 'admin') throw new Error('Nur Admins können das Team verwalten.')
  return viewer
}

/**
 * Person hinzufügen. Gibt es noch kein Supabase-Konto mit dieser Adresse, wird
 * eines ohne Passwort angelegt; die Person setzt es über «Passwort vergessen».
 */
export async function addTeamMember(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await assertOwner()
    const email = z.email('Bitte eine gültige E-Mail-Adresse eingeben.').parse(String(form.get('email') ?? '').trim().toLowerCase())
    const role = z.enum(['admin', 'moderator']).parse(form.get('role'))
    const svc = createAdminClient()
    let userId: string | undefined
    const created = await svc.auth.admin.createUser({ email, email_confirm: true })
    if (created.data.user) userId = created.data.user.id
    else if (created.error?.code === 'email_exists') {
      // Bestehendes Konto (z. B. aus dem Kursportal): ID über einen Login-Link ermitteln, ohne ihn zu versenden.
      const link = await svc.auth.admin.generateLink({ type: 'magiclink', email })
      userId = link.data.user?.id
    }
    if (!userId) throw new Error('Das Konto konnte nicht angelegt werden.')
    const { error } = await supabase.from('live_admins').upsert({ user_id: userId, email, role })
    if (error) throw new Error('Speichern fehlgeschlagen.')
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/admin/team')
  return { ok: true }
}

export async function setTeamRole(userId: string, role: 'admin' | 'moderator') {
  const { supabase, authId } = await assertOwner()
  if (userId === authId) throw new Error('Die eigene Rolle lässt sich nicht ändern.')
  await supabase.from('live_admins').update({ role }).eq('user_id', userId)
  revalidatePath('/admin/team')
}

export async function removeTeamMember(userId: string) {
  const { supabase, authId } = await assertOwner()
  if (userId === authId) throw new Error('Du kannst dich nicht selbst entfernen.')
  await supabase.from('live_admins').delete().eq('user_id', userId)
  revalidatePath('/admin/team')
}
