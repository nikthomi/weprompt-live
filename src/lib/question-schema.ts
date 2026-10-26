import { z } from 'zod'
import type { QuestionConfig, QuestionType } from './types'

const label = z.string().trim().min(1, 'Bitte alle Antwortmöglichkeiten ausfüllen.').max(120)

/** Prüft und bereinigt die Konfiguration je Fragetyp. Unbekannte Felder fallen weg. */
export function parseConfig(type: QuestionType, raw: unknown): QuestionConfig {
  switch (type) {
    case 'choice': {
      const c = z.object({
        options: z.array(z.object({ id: z.string().regex(/^[a-z0-9]{1,12}$/), label })).min(2, 'Mindestens zwei Antwortmöglichkeiten.').max(12, 'Höchstens zwölf Antwortmöglichkeiten.'),
        multiple: z.boolean().default(false),
        maxChoices: z.number().int().min(1).max(12).optional(),
      }).parse(raw)
      if (new Set(c.options.map(o => o.id)).size !== c.options.length) throw new Error('Doppelte Antwort-IDs.')
      return { options: c.options, multiple: c.multiple, ...(c.multiple && c.maxChoices ? { maxChoices: Math.min(c.maxChoices, c.options.length) } : {}) }
    }
    case 'scale': {
      const c = z.object({
        min: z.literal(1).default(1),
        max: z.union([z.literal(5), z.literal(10)]).default(5),
        minLabel: z.string().trim().max(40).default(''),
        maxLabel: z.string().trim().max(40).default(''),
      }).parse(raw)
      return c
    }
    case 'wordcloud':
      return z.object({ maxWords: z.number().int().min(1).max(5).default(3) }).parse(raw)
    case 'open':
      return z.object({ maxLength: z.number().int().min(20).max(500).default(200), moderation: z.boolean().default(false) }).parse(raw)
    case 'quiz': {
      const c = z.object({
        correct: z.enum(['yes', 'no'], 'Bitte die richtige Antwort wählen.'),
        seconds: z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30), z.literal(60)]).default(20),
        imageUrl: z.string().max(500).optional().or(z.literal('')),
        labels: z.object({
          yes: z.string().trim().min(1, 'Bitte beide Antworten beschriften.').max(30, 'Antworten höchstens 30 Zeichen.'),
          no: z.string().trim().min(1, 'Bitte beide Antworten beschriften.').max(30, 'Antworten höchstens 30 Zeichen.'),
        }).optional(),
      }).parse(raw)
      if (c.labels && c.labels.yes.toLowerCase() === c.labels.no.toLowerCase()) throw new Error('Die beiden Antworten brauchen verschiedene Beschriftungen.')
      const labels = c.labels && (c.labels.yes !== 'Richtig' || c.labels.no !== 'Falsch') ? { labels: c.labels } : {}
      // Nur Bilder aus dem eigenen Speicher: keine fremden Server auf dem Beamer und den Handys.
      const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/live-images/`
      if (c.imageUrl && !c.imageUrl.startsWith(prefix)) throw new Error('Das Bild muss über WePrompt Live hochgeladen werden.')
      return { correct: c.correct, seconds: c.seconds, ...labels, ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}) }
    }
    case 'yesno':
    case 'board':
      return {}
  }
}

export const QuestionInput = z.object({
  type: z.enum(['wordcloud', 'choice', 'yesno', 'scale', 'open', 'quiz', 'board']),
  title: z.string().trim().min(1, 'Bitte eine Frage eingeben.').max(300, 'Die Frage ist zu lang (max. 300 Zeichen).'),
  description: z.string().trim().max(1000).optional().transform(v => v || null),
  config: z.unknown(),
})
