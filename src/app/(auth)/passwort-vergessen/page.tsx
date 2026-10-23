import type { Metadata } from 'next'
import { AuthShell } from '@/components/AuthShell'
import { ResetRequestForm } from '../forms'

export const metadata: Metadata = { title: 'Passwort vergessen' }

export default function Page() {
  return (
    <AuthShell title="Passwort festlegen" intro={<>Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.</>}>
      <ResetRequestForm />
    </AuthShell>
  )
}
