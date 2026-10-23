import { createBrowserClient } from '@supabase/ssr'
import { createClient as createJsClient, type SupabaseClient } from '@supabase/supabase-js'

/** Browser-Client mit der Session der eingeloggten Person (Admin). */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

let anon: SupabaseClient | null = null
/** Anonymer Client nur für Realtime (Teilnehmende, Beamer). Keine Session, kein Cookie. */
export function anonClient() {
  anon ??= createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return anon
}
