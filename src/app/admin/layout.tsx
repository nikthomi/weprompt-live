import type { Metadata } from 'next'
import Link from 'next/link'
import { TopBar } from '@/components/ui'
import { requireAdmin } from '@/lib/auth'
import { signOut } from '../(auth)/actions'

export const metadata: Metadata = { title: { default: 'Sessions', template: '%s · WePrompt Live' } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin()
  const nav = [{ href: '/admin', label: 'Sessions' }, ...(admin.role === 'admin' ? [{ href: '/admin/team', label: 'Team' }] : [])]
  return (
    <div className="min-h-dvh bg-mist pb-20">
      <div className="bg-violett pb-5">
        <TopBar home="/admin">
          <span className="t-small hidden truncate md:inline">{admin.email}</span>
          <form action={signOut}><button className="wp-btn-quiet">Abmelden</button></form>
        </TopBar>
        <nav aria-label="Admin" className="mx-auto mt-4 max-w-[1312px] overflow-x-auto px-4 md:px-10">
          <ul className="flex gap-1">
            {nav.map(n => (
              <li key={n.href}>
                <Link href={n.href} className="t-caption block whitespace-nowrap rounded-[var(--radius-pill)] px-4 py-2 text-white hover:bg-white/15">{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-[1312px] px-4 pt-8 md:px-10 md:pt-10">{children}</div>
    </div>
  )
}
