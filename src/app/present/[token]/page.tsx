import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { joinUrl, shortJoinUrl } from '@/lib/app-url'
import type { Snapshot } from '@/lib/types'
import { Presenter } from './Presenter'

export const metadata: Metadata = { title: 'Präsentation', referrer: 'no-referrer' }

export default async function PresentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f]{64}$/.test(token)) notFound()
  const { data } = await createAdminClient().rpc('live_present', { p_token: token })
  if (!data) notFound()
  const snap = data as Snapshot
  return <Presenter token={token} initial={snap} joinUrl={joinUrl(snap.code)} joinLabel={shortJoinUrl(snap.code)} />
}
