import type { BoardItem } from '@/lib/types'

/** Beispiel-Leinwand für die /dev-Vorschauen. */
export const DEMO_BOARD: BoardItem[] = [
  { id: 'c1', kind: 'category', text: 'Chancen', x: 0.02, y: 0.04, w: 0.3, h: 0.9, size: 2 },
  { id: 'c2', kind: 'category', text: 'Risiken', x: 0.35, y: 0.04, w: 0.3, h: 0.9, size: 2 },
  { id: 'w1', kind: 'word', text: 'Zeit sparen', x: 0.17, y: 0.3, w: null, h: null, size: 3 },
  { id: 'w2', kind: 'word', text: 'Kreativität', x: 0.13, y: 0.5, w: null, h: null, size: 2 },
  { id: 'w3', kind: 'word', text: 'Recherche', x: 0.2, y: 0.68, w: null, h: null, size: 2 },
  { id: 'w4', kind: 'word', text: 'Datenschutz', x: 0.5, y: 0.32, w: null, h: null, size: 3 },
  { id: 'w5', kind: 'word', text: 'Halluzinationen', x: 0.5, y: 0.55, w: null, h: null, size: 2 },
  { id: 'w6', kind: 'word', text: 'Abhängigkeit', x: 0.82, y: 0.45, w: null, h: null, size: 2 },
]

/** Aktuelle Zeit für Beispiel-Timer (ausserhalb der Komponenten, Lint-Regel react-hooks/purity). */
export const serverTime = () => Date.now()
