// Gemeinsame Typen für Fragen, Zustand und Ergebnisse.
// Die Formen entsprechen den JSON-Rückgaben der SQL-Funktionen in der Migration.

export type QuestionType = 'wordcloud' | 'choice' | 'yesno' | 'scale' | 'open'

export type ChoiceOption = { id: string; label: string }

export type QuestionConfig = {
  // choice
  options?: ChoiceOption[]
  multiple?: boolean
  maxChoices?: number
  // scale
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
  // wordcloud
  maxWords?: number
  // open
  maxLength?: number
  moderation?: boolean
}

export type Question = {
  id: string
  session_id: string
  position: number
  type: QuestionType
  title: string
  description: string | null
  config: QuestionConfig
  enabled: boolean
}

export type SessionStatus = 'draft' | 'live' | 'ended' | 'archived'

export type Session = {
  id: string
  code: string
  present_token: string
  title: string
  description: string | null
  event_date: string | null
  status: SessionStatus
  current_question_id: string | null
  voting_open: boolean
  results_visible: boolean
  show_qr: boolean
  auto_show_results: boolean
  state_version: number
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export type PublicQuestion = {
  id: string
  type: QuestionType
  title: string
  description: string | null
  config: QuestionConfig
  number: number
  total: number
}

/** Was Teilnehmende und der Beamer über eine Session wissen dürfen. */
export type PublicState = {
  sessionId: string
  code: string
  title: string
  status: SessionStatus
  votingOpen: boolean
  resultsVisible: boolean
  showQr: boolean
  version: number
  question: PublicQuestion | null
}

export type JoinState = PublicState & { answered: boolean }

export type WordResult = { key: string; text: string; count: number; hidden: boolean }
export type OpenItem = { id: string; text: string; status: 'visible' | 'pending' | 'hidden'; at: string }

export type Results =
  | { type: 'choice' | 'yesno'; respondents: number; counts: Record<string, number> }
  | { type: 'scale'; respondents: number; distribution: Record<string, number>; average: number | null }
  | { type: 'wordcloud'; respondents: number; words: WordResult[] }
  | { type: 'open'; respondents: number; items: OpenItem[] }

export type Snapshot = PublicState & { participants: number; responses: number; results: Results | null }

export type AnswerValue =
  | { options: string[] }
  | { value: number }
  | { words: string[] }
  | { text: string }

export const QUESTION_TYPES: { type: QuestionType; label: string; hint: string }[] = [
  { type: 'wordcloud', label: 'Wortwolke', hint: 'Begriffe sammeln, häufige erscheinen grösser.' },
  { type: 'choice', label: 'Multiple Choice', hint: 'Antwortmöglichkeiten vorgeben, Balkendiagramm.' },
  { type: 'yesno', label: 'Ja/Nein', hint: 'Schnelle Abstimmung mit zwei Optionen.' },
  { type: 'scale', label: 'Skala', hint: 'Bewertung von 1 bis 5 oder 1 bis 10.' },
  { type: 'open', label: 'Offene Frage', hint: 'Kurze Textantworten als Karten.' },
]

export const typeLabel = (t: QuestionType) => QUESTION_TYPES.find(x => x.type === t)?.label ?? t

export const YES_NO: ChoiceOption[] = [{ id: 'yes', label: 'Ja' }, { id: 'no', label: 'Nein' }]

/** Optionen einer Auswahlfrage (Ja/Nein hat feste Optionen). */
export function optionsOf(type: QuestionType, config: QuestionConfig): ChoiceOption[] {
  return type === 'yesno' ? YES_NO : (config.options ?? [])
}

export function defaultConfig(type: QuestionType): QuestionConfig {
  switch (type) {
    case 'wordcloud': return { maxWords: 3 }
    case 'choice': return { options: [{ id: 'a', label: '' }, { id: 'b', label: '' }], multiple: false }
    case 'scale': return { min: 1, max: 5, minLabel: '', maxLabel: '' }
    case 'open': return { maxLength: 200, moderation: false }
    default: return {}
  }
}

export const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: 'Entwurf',
  live: 'Live',
  ended: 'Beendet',
  archived: 'Archiviert',
}
