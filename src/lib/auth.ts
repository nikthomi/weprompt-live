import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

export type AdminRole = 'admin' | 'moderator'
export type Admin = { user_id: string; email: string; role: AdminRole }

/** Eingeloggte Person dieser Anfrage; admin ist null ohne Eintrag in live_admins. */
export const getViewer = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const authId = data?.claims?.sub ?? null
  if (!authId) return { supabase, authId: null, admin: null }
  const { data: admin } = await supabase.from('live_admins').select('user_id, email, role').eq('user_id', authId).maybeSingle<Admin>()
  return { supabase, authId, admin }
})

export async function requireAdmin() {
  const viewer = await getViewer()
  if (!viewer.authId) redirect('/login')
  if (!viewer.admin) redirect('/kein-zugang')
  return { ...viewer, admin: viewer.admin }
}

/** Für Server Actions und Routen: wirft statt umzuleiten. */
export async function assertAdmin() {
  const viewer = await getViewer()
  if (!viewer.admin) throw new Error('Keine Berechtigung')
  return { ...viewer, admin: viewer.admin }
}
