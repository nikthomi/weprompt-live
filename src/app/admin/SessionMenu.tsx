'use client'

import { useRef, useTransition } from 'react'
import { deleteSession, duplicateSession, resetSession, setArchived } from './actions'

export function SessionMenu({ id, archived, canDelete }: { id: string; archived: boolean; canDelete: boolean }) {
  const [pending, start] = useTransition()
  const details = useRef<HTMLDetailsElement>(null)

  function run(action: () => void) {
    details.current?.removeAttribute('open')
    start(action)
  }

  return (
    <details ref={details} className="relative">
      <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full font-bold tracking-[0.14em] transition-colors hover:bg-mist [&::-webkit-details-marker]:hidden" aria-label="Weitere Aktionen">
        <span aria-hidden>•••</span>
      </summary>
      <div className="absolute right-0 top-12 z-20 min-w-48 rounded-[16px] border border-black/15 bg-white p-2">
        <button type="button" className="w-full rounded-[10px] px-3 py-2 text-left text-[15px] font-semibold hover:bg-mist disabled:opacity-50" disabled={pending} onClick={() => run(() => duplicateSession(id))}>Duplizieren</button>
        {archived ? null : (
          <button type="button" className="w-full rounded-[10px] px-3 py-2 text-left text-[15px] font-semibold hover:bg-mist disabled:opacity-50" disabled={pending}
            onClick={() => { if (confirm('Session zurücksetzen? Alle Antworten und Teilnehmenden werden gelöscht, die Session steht wieder auf Entwurf. Fragen und vorbereitete Kategorien bleiben. Das lässt sich nicht rückgängig machen.')) run(() => resetSession(id)) }}>
            Zurücksetzen
          </button>
        )}
        <button type="button" className="w-full rounded-[10px] px-3 py-2 text-left text-[15px] font-semibold hover:bg-mist disabled:opacity-50" disabled={pending} onClick={() => run(() => setArchived(id, !archived))}>
          {archived ? 'Wiederherstellen' : 'Archivieren'}
        </button>
        {canDelete ? (
          <button type="button" className="mt-1 w-full border-t border-black/10 px-3 pb-2 pt-3 text-left text-[15px] font-semibold text-coral hover:bg-mist disabled:opacity-50" disabled={pending}
            onClick={() => { if (confirm('Session endgültig löschen? Alle Fragen, Antworten und Teilnehmenden werden gelöscht. Das lässt sich nicht rückgängig machen.')) run(() => deleteSession(id)) }}>
            Löschen
          </button>
        ) : null}
      </div>
    </details>
  )
}
