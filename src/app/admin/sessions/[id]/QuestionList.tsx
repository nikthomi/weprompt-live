'use client'

import { useState, useTransition } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { QUESTION_TYPES, typeLabel, type Question, type QuestionType } from '@/lib/types'
import { addQuestion, reorderQuestions } from '../../actions'
import { QuestionEditor } from './QuestionEditor'

export function QuestionList({ sessionId, questions, responseCounts, currentId }: {
  sessionId: string
  questions: Question[]
  responseCounts: Record<string, number>
  currentId: string | null
}) {
  const [order, setOrder] = useState(questions)
  const [open, setOpen] = useState<string | null>(null)
  const [pending, start] = useTransition()
  // Neue Daten vom Server übernehmen (nach Speichern, Hinzufügen, Löschen).
  const [synced, setSynced] = useState(questions)
  if (synced !== questions) {
    setSynced(questions)
    setOrder(questions)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    const from = order.findIndex(q => q.id === e.active.id)
    const to = order.findIndex(q => q.id === e.over!.id)
    const next = arrayMove(order, from, to)
    setOrder(next)
    start(() => reorderQuestions(sessionId, next.map(q => q.id)))
  }

  function add(type: QuestionType) {
    start(async () => {
      const r = await addQuestion(sessionId, type)
      if (r.id) setOpen(r.id)
    })
  }

  const numbers = new Map<string, number>()
  for (const q of order) if (q.enabled) numbers.set(q.id, numbers.size + 1)
  return (
    <section aria-labelledby="questions-h" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id="questions-h" className="t-h2">Fragen</h2>
        <p className="t-small text-gray">Zum Sortieren am Griff ziehen</p>
      </div>

      {order.length === 0 ? (
        <p className="t-body rounded-[var(--radius-card)] bg-white px-6 py-8">Noch keine Fragen. Wähle unten einen Fragetyp.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map(q => q.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-3">
              {order.map(q => (
                <SortableItem
                  key={q.id}
                  question={q}
                  number={numbers.get(q.id) ?? null}
                  responses={responseCounts[q.id] ?? 0}
                  isCurrent={q.id === currentId}
                  open={open === q.id}
                  onToggle={() => setOpen(open === q.id ? null : q.id)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <div className="rounded-[var(--radius-card)] bg-white p-5">
        <p className="wp-label">Frage hinzufügen</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {QUESTION_TYPES.map(t => (
            <button key={t.type} type="button" disabled={pending} onClick={() => add(t.type)}
              className="rounded-[16px] bg-mist px-4 py-3 text-left transition-colors hover:bg-amber disabled:opacity-50">
              <span className="block font-[family-name:var(--font-brand)] text-[17px] font-semibold">{t.label}</span>
              <span className="block text-[14px] leading-[19px]">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function SortableItem({ question, number, responses, isCurrent, open, onToggle }: {
  question: Question
  number: number | null
  responses: number
  isCurrent: boolean
  open: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-[var(--radius-card)] bg-white ${isDragging ? 'relative z-10 ring-2 ring-black' : ''} ${question.enabled ? '' : 'opacity-70'}`}
    >
      <div className="flex items-center gap-3 p-4 pr-5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg hover:bg-mist active:cursor-grabbing"
          aria-label={`Frage «${question.title}» verschieben`}
          {...attributes}
          {...listeners}
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor" aria-hidden><circle cx="3" cy="4" r="1.8" /><circle cx="9" cy="4" r="1.8" /><circle cx="3" cy="10" r="1.8" /><circle cx="9" cy="10" r="1.8" /><circle cx="3" cy="16" r="1.8" /><circle cx="9" cy="16" r="1.8" /></svg>
        </button>
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber font-[family-name:var(--font-brand)] text-[17px] font-bold">
            {number ?? '–'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-[family-name:var(--font-brand)] text-[19px] font-semibold">{question.title}</span>
            <span className="t-small block text-gray">
              {typeLabel(question.type)}
              {responses ? ` · ${responses} ${responses === 1 ? 'Antwort' : 'Antworten'}` : ''}
              {question.enabled ? '' : ' · deaktiviert'}
            </span>
          </span>
          {isCurrent ? <span className="wp-tag shrink-0 bg-black !text-white">Aktiv</span> : null}
          <svg className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M1.5 1.5 8 8l6.5-6.5" /></svg>
        </button>
      </div>
      {open ? <QuestionEditor question={question} responses={responses} /> : null}
    </li>
  )
}
