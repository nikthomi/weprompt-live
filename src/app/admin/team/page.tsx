import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAdmin, type Admin } from '@/lib/auth'
import { AddMember, MemberActions } from './TeamForms'

export const metadata: Metadata = { title: 'Team' }

export default async function TeamPage() {
  const { supabase, admin: me } = await requireAdmin()
  if (me.role !== 'admin') redirect('/admin')
  const { data } = await supabase.from('live_admins').select('user_id, email, role').order('email')
  const members = (data ?? []) as Admin[]
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="t-h1">Team</h1>
        <p className="t-body mt-2 max-w-[720px]">Moderatorinnen und Moderatoren erstellen und steuern Sessions. Admins können zusätzlich das Team verwalten und Sessions endgültig löschen.</p>
      </div>
      <AddMember />
      <ul className="flex flex-col gap-2">
        {members.map(m => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-white px-5 py-4">
            <span className="min-w-0 flex-1 break-all font-semibold">{m.email}{m.user_id === me.user_id ? ' (du)' : ''}</span>
            <span className="wp-tag">{m.role === 'admin' ? 'Admin' : 'Moderation'}</span>
            {m.user_id !== me.user_id ? <MemberActions userId={m.user_id} role={m.role} /> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
