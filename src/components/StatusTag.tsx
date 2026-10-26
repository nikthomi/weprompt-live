import { STATUS_LABEL, type SessionStatus } from '@/lib/types'

export function StatusTag({ status, compact = false }: { status: SessionStatus; compact?: boolean }) {
  return (
    <span className={`wp-tag shrink-0 gap-2 ${compact ? 'compact' : ''} ${status === 'live' ? 'live bg-black !text-white' : ''}`}>
      {status === 'live' ? <span className="wp-pulse inline-block h-2 w-2 rounded-full bg-coral" aria-hidden /> : null}
      {STATUS_LABEL[status]}
    </span>
  )
}
