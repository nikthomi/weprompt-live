import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/AuthShell'
import { getViewer } from '@/lib/auth'
import { NewPasswordForm } from '../forms'

export const metadata: Metadata = { title: 'Neues Passwort' }

export default async function Page() {
  const { authId } = await getViewer()
  if (!authId) redirect('/login?error=link')
  return (
    <AuthShell title="Neues Passwort">
      <NewPasswordForm />
    </AuthShell>
  )
}
