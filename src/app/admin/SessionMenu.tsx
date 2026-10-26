'use client'

import { useTransition } from 'react'
import { duplicateSession, resetSession, setArchived } from './actions'

export function SessionMenu({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition()
  return (
    <>
      <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => start(() => duplicateSession(id))}>Duplizieren</button>
      {archived ? null : (
        <button type="button" className="wp-btn-quiet" disabled={pending}
          onClick={() => { if (confirm('Session zurücksetzen? Alle Antworten und Teilnehmenden werden gelöscht, die Session steht wieder auf Entwurf. Fragen und vorbereitete Kategorien bleiben. Das lässt sich nicht rückgängig machen.')) start(() => resetSession(id)) }}>
          Zurücksetzen
        </button>
      )}
      <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => start(() => setArchived(id, !archived))}>
        {archived ? 'Wiederherstellen' : 'Archivieren'}
      </button>
    </>
  )
}
