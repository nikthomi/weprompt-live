import type { Metadata } from 'next'
import { AuthShell } from '@/components/AuthShell'
import { safeNext } from '@/lib/safe-next'
import { LoginForm } from '../forms'

export const metadata: Metadata = { title: 'Login' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; error?: string }> }) {
  const { next, email, error } = await searchParams
  return (
    <AuthShell title="WePrompt Live" intro={<>Sessions vorbereiten, live abstimmen lassen und Ergebnisse zeigen.</>}>
      {error === 'link' ? <p className="t-body mb-6">Der Link ist abgelaufen oder wurde schon verwendet. Melde dich an oder fordere einen neuen an.</p> : null}
      <LoginForm next={next ? safeNext(next) : undefined} email={email} />
    </AuthShell>
  )
}
