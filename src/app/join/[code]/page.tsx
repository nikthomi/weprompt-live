import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import type { JoinState } from '@/lib/types'
import { Participant } from './Participant'

export const metadata: Metadata = { title: 'Mitmachen' }

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(code)) redirect('/?fehler=code')
  // Erster Zustand ohne Gerätekennung (die kennt nur der Browser); der Client meldet sich danach an.
  const { data } = await createAdminClient().rpc('live_join', { p_code: code, p_participant_id: null })
  if (!data) redirect('/?fehler=code')
  return <Participant code={code} initial={data as JoinState} />
}
