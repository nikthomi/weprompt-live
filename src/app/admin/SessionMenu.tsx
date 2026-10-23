'use client'

import { useTransition } from 'react'
import { duplicateSession, setArchived } from './actions'

export function SessionMenu({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition()
  return (
    <>
      <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => start(() => duplicateSession(id))}>Duplizieren</button>
      <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => start(() => setArchived(id, !archived))}>
        {archived ? 'Wiederherstellen' : 'Archivieren'}
      </button>
    </>
  )
}
