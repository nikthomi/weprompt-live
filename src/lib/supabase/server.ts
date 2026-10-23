import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createJsClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Supabase mit der Session der eingeloggten Person. Alle Abfragen laufen über
 * Row Level Security – das ist der Standard für alles, was Personen sehen.
 */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(toSet) {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
          } catch {
            // Aus Server Components lassen sich keine Cookies setzen; proxy.ts erneuert die Session.
          }
        },
      },
    },
  )
}

/**
 * Service-Role-Client, umgeht RLS. Nur für Dinge, die eine Person nicht selbst
 * darf: öffentliche Teilnahme- und Beamer-Routen, Konten anlegen, Mailversand.
 */
export function createAdminClient() {
  return createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
