'use server'

import { revalidatePath } from 'next/cache'
import { assertAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'kuh'
const NAME_RE = /^[a-z0-9-]{4,60}\.(jpg|png|webp)$/

export type KuhResult = { ok?: boolean; error?: string }

/** Ein Bild der Kreativ-Challenge löschen (Admin und Moderation). */
export async function deleteKuhImage(name: string): Promise<KuhResult> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Keine Berechtigung.' }
  }
  if (!NAME_RE.test(name)) return { error: 'Ungültiger Dateiname.' }
  const { error } = await createAdminClient().storage.from(BUCKET).remove([name])
  if (error) return { error: 'Das Bild konnte nicht gelöscht werden.' }
  revalidatePath('/admin/kuh')
  return { ok: true }
}

/** Die ganze Galerie leeren (nur Admins). */
export async function clearKuhGallery(): Promise<KuhResult & { removed?: number }> {
  let role: string
  try {
    role = (await assertAdmin()).admin.role
  } catch {
    return { error: 'Keine Berechtigung.' }
  }
  if (role !== 'admin') return { error: 'Nur Admins dürfen die ganze Galerie leeren.' }
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 })
  if (error) return { error: 'Die Galerie konnte nicht gelesen werden.' }
  const names = (data ?? []).map(f => f.name).filter(n => NAME_RE.test(n))
  if (names.length === 0) return { ok: true, removed: 0 }
  const { error: delError } = await supabase.storage.from(BUCKET).remove(names)
  if (delError) return { error: 'Das Leeren hat nicht geklappt.' }
  revalidatePath('/admin/kuh')
  return { ok: true, removed: names.length }
}
