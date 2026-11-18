import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { KuhAdmin } from './KuhAdmin'

export const metadata: Metadata = { title: 'Kreativ-Challenge' }

export default async function Page() {
  const { admin } = await requireAdmin()
  return <KuhAdmin canClear={admin.role === 'admin'} />
}
