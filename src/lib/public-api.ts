import 'server-only'
import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

export const CODE_RE = /^[A-Z0-9]{6}$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
}

/**
 * Netz-Kennung für das Rate Limit: gesalzener Hash der IP. Die IP selbst wird
 * nirgends gespeichert; der Hash liegt höchstens eine Stunde in live_rate_limits.
 */
export function clientKey(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (!ip) return null
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'weprompt-live'
  return createHash('sha256').update(`${salt}:${ip}`).digest('base64url').slice(0, 22)
}
