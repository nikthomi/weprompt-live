import type { Metadata } from 'next'
import { AuthShell } from '@/components/AuthShell'
import { signOut } from '../actions'

export const metadata: Metadata = { title: 'Kein Zugang' }

export default function Page() {
  return (
    <AuthShell title="Kein Zugang">
      <p className="t-body">Dein Konto ist für WePrompt Live nicht freigeschaltet. Eine Person mit Admin-Rechten kann dich unter «Team» hinzufügen.</p>
      <form action={signOut} className="mt-6"><button className="wp-btn wp-btn-primary wp-btn-block">Abmelden</button></form>
    </AuthShell>
  )
}
