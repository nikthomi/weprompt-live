import type { BoardItem } from '@/lib/types'

/** Seitenverhältnis der Leinwand – überall gleich, damit Positionen übereinstimmen. */
export const BOARD_RATIO = 16 / 7

/** Schriftgrösse der Begriffe in Prozent der Leinwandbreite (cqw), Stufen 1–4. */
export const WORD_SIZE = [0, 1.9, 2.6, 3.6, 5] as const

export const inside = (word: Pick<BoardItem, 'x' | 'y'>, cat: BoardItem) =>
  cat.w !== null && cat.h !== null && word.x >= cat.x && word.x <= cat.x + cat.w && word.y >= cat.y && word.y <= cat.y + cat.h

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/**
 * Freier Platz für einen neuen Begriff: Raster in der gewählten Kategorie oder
 * – ohne Auswahl – auf der freien Fläche. Nimmt den ersten Punkt, der weit
 * genug von anderen Begriffen entfernt ist.
 */
export function freeSpot(items: BoardItem[], within: BoardItem | null) {
  const words = items.filter(i => i.kind === 'word')
  const cats = items.filter(i => i.kind === 'category')
  const area = within && within.w && within.h
    ? { x: within.x + 0.03, y: within.y + 0.16, w: within.w - 0.06, h: within.h - 0.2 }
    : { x: 0.06, y: 0.1, w: 0.88, h: 0.8 }
  const cols = Math.max(1, Math.round(area.w / 0.16))
  const rows = Math.max(1, Math.round(area.h / 0.13))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = area.x + (cols === 1 ? area.w / 2 : (c + 0.5) * (area.w / cols))
      const y = area.y + (rows === 1 ? area.h / 2 : (r + 0.5) * (area.h / rows))
      const taken = words.some(w => Math.abs(w.x - x) < 0.09 && Math.abs(w.y - y) < 0.07)
      const blocked = !within && cats.some(cat => inside({ x, y }, cat))
      if (!taken && !blocked) return { x: clamp(x), y: clamp(y) }
    }
  }
  return { x: clamp(area.x + area.w / 2 + (Math.random() - 0.5) * 0.1), y: clamp(area.y + area.h / 2 + (Math.random() - 0.5) * 0.1) }
}
