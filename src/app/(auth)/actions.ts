'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'
import { APP_URL } from '@/lib/app-url'
import { isMailConfigured, sendMail } from '@/lib/mail'

export type FormState = { error?: string; ok?: string } | undefined

const MIN_PASSWORD = 10

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const next = safeNext(String(form.get('next') ?? ''))
  if (!email || !password) return { error: 'Bitte E-Mail-Adresse und Passwort eingeben.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'E-Mail-Adresse oder Passwort stimmen nicht.' }
  redirect(next)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Passwort vergessen bzw. erstmals festlegen. Antwortet immer gleich, damit
 * niemand herausfinden kann, welche Adressen ein Konto haben.
 */
export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (!z.email().safeParse(email).success) return { error: 'Bitte eine gültige E-Mail-Adresse eingeben.' }
  const done: FormState = { ok: 'Falls zu dieser Adresse ein Zugang besteht, haben wir dir soeben eine E-Mail geschickt. Schau auch im Spam-Ordner nach.' }
  if (!isMailConfigured()) return { error: 'Der E-Mail-Versand ist noch nicht eingerichtet. Bitte melde dich bei info@weprompt.ch.' }

  const admin = createAdminClient()
  const { data: row } = await admin.from('live_admins').select('user_id').eq('email', email).maybeSingle()
  if (!row) return done

  // Höchstens eine Mail alle zwei Minuten pro Adresse.
  const { data: allowed } = await admin.rpc('live_rate_hit', { p_key: `reset:${email}`, p_limit: 1, p_window_seconds: 120 })
  if (!allowed) return done

  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data.properties?.hashed_token) return done
  const url = `${APP_URL}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/passwort-setzen`
  try {
    await sendMail(email, 'Passwort für WePrompt Live', {
      preheader: 'Lege dein Passwort für WePrompt Live fest.',
      greeting: 'Hallo',
      paragraphs: ['Über den Button legst du dein Passwort für WePrompt Live fest. Der Link ist eine Stunde gültig.'],
      button: { label: 'Passwort festlegen', url },
      footnote: 'Du hast nichts angefordert? Dann kannst du diese E-Mail ignorieren, dein Passwort bleibt unverändert.',
    })
  } catch (e) {
    console.error('live: Passwort-Mail fehlgeschlagen', e)
  }
  return done
}

export async function setNewPassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') ?? '')
  if (password.length < MIN_PASSWORD) return { error: `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.` }
  if (password !== String(form.get('password2') ?? '')) return { error: 'Die beiden Passwörter stimmen nicht überein.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.code === 'same_password' ? 'Bitte wähle ein anderes Passwort als bisher.' : 'Das hat nicht geklappt. Fordere bitte einen neuen Link an.' }
  redirect('/admin')
}
