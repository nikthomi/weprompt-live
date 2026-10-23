import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

/** Link aus der Passwort-Mail: Token prüfen, Session setzen, weiter zum Ziel. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null
  const next = safeNext(request.nextUrl.searchParams.get('next'))

  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, request.url))
  }
  return NextResponse.redirect(new URL('/login?error=link', request.url))
}
