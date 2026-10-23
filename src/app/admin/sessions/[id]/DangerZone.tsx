'use client'

import { useTransition } from 'react'
import type { SessionStatus } from '@/lib/types'
import { deleteSession, duplicateSession, resetSession, setArchived } from '../../actions'

export function DangerZone({ id, status, canDelete }: { id: string; status: SessionStatus; canDelete: boolean }) {
  const [pending, start] = useTransition()
  const run = (question: string | null, fn: () => Promise<unknown>) => {
    if (question && !confirm(question)) return
    start(async () => { await fn() })
  }
  return (
    <section className="panel" aria-labelledby="tools-h">
      <h2 id="tools-h" className="t-h3">Verwalten</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => run(null, () => duplicateSession(id))}>Duplizieren</button>
        <button type="button" className="wp-btn-quiet" disabled={pending}
          onClick={() => run('Alle Antworten dieser Session löschen und zurück auf Entwurf setzen? Das lässt sich nicht rückgängig machen.', () => resetSession(id))}>
          Zurücksetzen
        </button>
        <button type="button" className="wp-btn-quiet" disabled={pending} onClick={() => run(null, () => setArchived(id, status !== 'archived'))}>
          {status === 'archived' ? 'Wiederherstellen' : 'Archivieren'}
        </button>
        {canDelete ? (
          <button type="button" className="wp-btn-quiet" disabled={pending}
            onClick={() => run('Session mit allen Fragen und Antworten endgültig löschen?', () => deleteSession(id))}>
            Löschen
          </button>
        ) : null}
      </div>
      <p className="t-small mt-4 text-gray">Duplizieren übernimmt die Fragen ohne Antworten, mit neuem Code.</p>
    </section>
  )
}
