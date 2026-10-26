'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { BoardItem } from '@/lib/types'
import { CATEGORY_CLASS, CATEGORY_LABEL_CLASS, WORD_CLASS, categoryStyle, wordStyle } from './BoardCanvas'
import { BOARD_RATIO, clamp, freeSpot, inside } from './geometry'

type Drag = {
  mode: 'move' | 'resize'
  id: string
  startX: number
  startY: number
  rect: DOMRect
  origin: Map<string, { x: number; y: number; w: number | null; h: number | null }>
}

/**
 * Editor der manuellen Wortwolke: Begriffe und Kategorien anlegen, frei
 * verschieben, Kategorien in der Grösse ändern. Begriffe in einer Kategorie
 * wandern mit, wenn die Kategorie verschoben wird. Änderungen werden während
 * des Ziehens gedrosselt gespeichert, damit der Beamer mitläuft.
 */
/** demo: Beispieldaten ohne Laden und Speichern (nur für /dev-Vorschauen). */
export function BoardEditor({ questionId, demo }: { questionId: string; demo?: BoardItem[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<BoardItem[]>(demo ?? [])
  const [loaded, setLoaded] = useState(Boolean(demo))
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const lastSave = useRef(0)
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    if (demo) return
    let cancelled = false
    supabase.from('live_board_items').select('id, kind, text, x, y, w, h, size').eq('question_id', questionId).order('created_at')
      .then(({ data }) => { if (!cancelled) { setItems((data ?? []) as BoardItem[]); setLoaded(true) } })
    return () => { cancelled = true }
  }, [supabase, questionId, demo])

  const persist = useCallback(async (rows: BoardItem[]) => {
    if (!rows.length || demo) return
    const { error } = await supabase.from('live_board_items').upsert(rows.map(r => ({ ...r, question_id: questionId })))
    setError(error ? 'Speichern fehlgeschlagen. Prüfe die Verbindung.' : null)
  }, [supabase, questionId, demo])

  const remove = useCallback(async (id: string) => {
    setItems(list => list.filter(i => i.id !== id))
    setSelected(null)
    if (demo) return
    const { error } = await supabase.from('live_board_items').delete().eq('id', id)
    if (error) setError('Löschen fehlgeschlagen.')
  }, [supabase, demo])

  function add(kind: BoardItem['kind'], text: string) {
    const clean = text.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (!clean) return
    const sel = items.find(i => i.id === selected && i.kind === 'category') ?? null
    const item: BoardItem = kind === 'word'
      ? { id: crypto.randomUUID(), kind, text: clean, ...freeSpot(items, sel), w: null, h: null, size: 2 }
      : { id: crypto.randomUUID(), kind, text: clean, ...categorySpot(items), w: 0.3, h: 0.5, size: 2 }
    setItems(list => [...list, item])
    if (kind === 'category') {
      // Neue Kategorie gleich benennen.
      setSelected(item.id)
      setEditing(item.id)
      setDraft('')
    }
    persist([item])
  }

  function update(id: string, patch: Partial<BoardItem>) {
    const next = items.map(i => (i.id === id ? { ...i, ...patch } : i))
    setItems(next)
    persist(next.filter(i => i.id === id))
  }

  // ── Ziehen und Grösse ändern ──────────────────────────────────────────────
  function start(e: ReactPointerEvent, id: string, mode: Drag['mode']) {
    if (editing || e.button !== 0 || !canvas.current) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setSelected(id)
    const item = items.find(i => i.id === id)!
    const moving = mode === 'move' && item.kind === 'category'
      ? items.filter(i => i.id === id || (i.kind === 'word' && inside(i, item)))
      : [item]
    drag.current = {
      mode, id, startX: e.clientX, startY: e.clientY, rect: canvas.current.getBoundingClientRect(),
      origin: new Map(moving.map(i => [i.id, { x: i.x, y: i.y, w: i.w, h: i.h }])),
    }
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.startX) / d.rect.width
    const dy = (e.clientY - d.startY) / d.rect.height
    setItems(list => list.map(i => {
      const o = d.origin.get(i.id)
      if (!o) return i
      if (d.mode === 'resize') return { ...i, w: clamp((o.w ?? 0.3) + dx, 0.08, 1 - i.x), h: clamp((o.h ?? 0.4) + dy, 0.12, 1 - i.y) }
      if (i.kind === 'category') return { ...i, x: clamp(o.x + dx, 0, 1 - (i.w ?? 0.3)), y: clamp(o.y + dy, 0, 1 - (i.h ?? 0.4)) }
      return { ...i, x: clamp(o.x + dx), y: clamp(o.y + dy) }
    }))
    // Während des Ziehens höchstens alle 250 ms speichern, damit der Beamer mitläuft.
    if (Date.now() - lastSave.current > 250) {
      lastSave.current = Date.now()
      queueMicrotask(() => persist(itemsRef.current.filter(i => d.origin.has(i.id))))
    }
  }

  function end() {
    const d = drag.current
    if (!d) return
    drag.current = null
    // Nach dem letzten Render speichern, damit die Endposition sicher dabei ist.
    setTimeout(() => persist(itemsRef.current.filter(i => d.origin.has(i.id))), 0)
  }

  // ── Tastatur: Entf löscht, Pfeile verschieben fein, Enter benennt um ──────
  function onKey(e: React.KeyboardEvent) {
    if (editing || !selected) return
    const item = items.find(i => i.id === selected)
    if (!item) return
    const step = e.shiftKey ? 0.05 : 0.01
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(item.id) }
    else if (e.key === 'Enter') { e.preventDefault(); beginEdit(item) }
    else if (e.key === 'Escape') setSelected(null)
    else if (arrows[e.key]) {
      e.preventDefault()
      const [dx, dy] = arrows[e.key]
      update(item.id, item.kind === 'category'
        ? { x: clamp(item.x + dx, 0, 1 - (item.w ?? 0.3)), y: clamp(item.y + dy, 0, 1 - (item.h ?? 0.4)) }
        : { x: clamp(item.x + dx), y: clamp(item.y + dy) })
    }
  }

  function beginEdit(item: BoardItem) {
    setEditing(item.id)
    setDraft(item.text)
  }
  function commitEdit() {
    const id = editing
    setEditing(null)
    const text = draft.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (id && text) update(id, { text })
  }

  const sel = items.find(i => i.id === selected) ?? null

  return (
    <div className="flex flex-col gap-4" data-board>
      <AddBar onAdd={add} categorySelected={sel?.kind === 'category' ? sel.text : null} />

      <div className="flex min-h-[38px] flex-wrap items-center gap-2" aria-live="polite">
        {sel ? (
          <>
            <span className="t-small mr-1 text-gray">Ausgewählt: <strong className="text-black">{sel.text}</strong></span>
            {sel.kind === 'word' ? (
              <>
                <button type="button" className="wp-btn-quiet" disabled={sel.size >= 4} onClick={() => update(sel.id, { size: sel.size + 1 })}>Grösser</button>
                <button type="button" className="wp-btn-quiet" disabled={sel.size <= 1} onClick={() => update(sel.id, { size: sel.size - 1 })}>Kleiner</button>
              </>
            ) : null}
            <button type="button" className="wp-btn-quiet" onClick={() => beginEdit(sel)}>Umbenennen</button>
            <button type="button" className="wp-btn-quiet" onClick={() => remove(sel.id)}>Löschen</button>
          </>
        ) : (
          <span className="t-small text-gray">Ziehen zum Verschieben · Doppelklick zum Umbenennen · Kategorie: Ecke unten rechts ziehen für die Grösse</span>
        )}
      </div>

      <div
        className="stage relative w-full overflow-hidden rounded-[14px] bg-violett outline-none"
        style={{ aspectRatio: String(BOARD_RATIO) }}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={() => { if (!editing) setSelected(null) }}
        aria-label="Leinwand der manuellen Wortwolke"
      >
        <div ref={canvas} className="absolute inset-0 [container-type:inline-size]" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          {items.filter(i => i.kind === 'category').map(c => (
            <div
              key={c.id}
              className={`${CATEGORY_CLASS} cursor-grab touch-none active:cursor-grabbing ${selected === c.id ? '!border-white/80' : ''}`}
              style={categoryStyle(c)}
              onPointerDown={e => start(e, c.id, 'move')}
              onDoubleClick={() => beginEdit(c)}
            >
              {editing === c.id ? (
                <EditField value={draft} onChange={setDraft} onCommit={commitEdit} onCancel={() => setEditing(null)} className="left-[1.2cqw] top-[.6cqw] text-[1.7cqw]" />
              ) : (
                <span className={CATEGORY_LABEL_CLASS}>{c.text}</span>
              )}
              <span
                className="absolute bottom-0 right-0 h-[2.2cqw] min-h-4 w-[2.2cqw] min-w-4 cursor-nwse-resize touch-none rounded-br-[1.2cqw] border-b-2 border-r-2 border-white/60"
                onPointerDown={e => start(e, c.id, 'resize')}
                aria-hidden
              />
            </div>
          ))}
          {items.filter(i => i.kind === 'word').map(w => (
            editing === w.id ? (
              <EditField key={w.id} value={draft} onChange={setDraft} onCommit={commitEdit} onCancel={() => setEditing(null)}
                className="-translate-x-1/2 -translate-y-1/2" style={wordStyle(w)} />
            ) : (
              <span
                key={w.id}
                className={`${WORD_CLASS} cursor-grab touch-none select-none active:cursor-grabbing ${selected === w.id ? 'ring-2 ring-white' : ''}`}
                style={wordStyle(w)}
                onPointerDown={e => start(e, w.id, 'move')}
                onDoubleClick={() => beginEdit(w)}
              >
                {w.text}
              </span>
            )
          ))}
          {loaded && items.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-[1.8cqw] text-white/60">Schreib oben den ersten Begriff, den jemand nennt.</p>
          ) : null}
        </div>
      </div>
      {error ? <p role="alert" className="rounded-[16px] bg-white px-4 py-3 ring-2 ring-coral">{error}</p> : null}
    </div>
  )
}

/** Neue Kategorie rechts neben die bestehenden setzen, sonst links oben. */
function categorySpot(items: BoardItem[]) {
  const cats = items.filter(i => i.kind === 'category')
  const x = cats.length ? Math.max(...cats.map(c => c.x + (c.w ?? 0.3))) + 0.02 : 0.02
  return x + 0.3 <= 1 ? { x, y: 0.04 } : { x: 0.35, y: 0.25 }
}

function AddBar({ onAdd, categorySelected }: { onAdd: (kind: BoardItem['kind'], text: string) => void; categorySelected: string | null }) {
  const [word, setWord] = useState('')
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={e => { e.preventDefault(); onAdd('word', word); setWord('') }}
    >
      <div className="wp-field min-w-[220px] flex-1">
        <label htmlFor="board-word">{categorySelected ? `Begriff in «${categorySelected}»` : 'Begriff'}</label>
        <input id="board-word" className="wp-input" value={word} maxLength={80} autoComplete="off" placeholder="Was wurde genannt?" onChange={e => setWord(e.target.value)} />
      </div>
      <button type="submit" className="wp-btn wp-btn-primary">Hinzufügen</button>
      <button type="button" className="wp-btn-quiet" onClick={() => onAdd('category', 'Neue Kategorie')}>Kategorie hinzufügen</button>
    </form>
  )
}

function EditField({ value, onChange, onCommit, onCancel, className = '', style }: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <input
      autoFocus
      className={`absolute z-10 w-[18cqw] min-w-[120px] rounded-[8px] bg-white px-2 py-1 font-[family-name:var(--font-brand)] font-semibold text-black outline-none ${className}`}
      style={style}
      value={value}
      maxLength={80}
      onChange={e => onChange(e.target.value)}
      onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommit()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCommit}
      aria-label="Text bearbeiten"
    />
  )
}
