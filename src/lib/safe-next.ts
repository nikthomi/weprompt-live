/** Nur interne Pfade als Weiterleitungsziel zulassen. */
export function safeNext(next: string | null | undefined, fallback = '/admin') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
