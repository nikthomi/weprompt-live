import type { PublicQuestion, Results } from '@/lib/types'
import { optionsOf } from '@/lib/types'
import { AnswerCards } from './AnswerCards'
import { Bars } from './Bars'
import { Scale } from './Scale'
import { WordCloud } from './WordCloud'
import { YesNo } from './YesNo'

/** Ergebnis einer Frage auf violettem Grund. Füllt den umgebenden Container (.stage). */
export function ResultView({ question, results }: { question: Pick<PublicQuestion, 'type' | 'config'>; results: Results | null }) {
  if (!results || results.respondents === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="stage-label text-white/70">Noch keine Antworten</p>
      </div>
    )
  }
  const c = question.config
  switch (results.type) {
    case 'choice':
      return <Bars options={optionsOf('choice', c)} counts={results.counts} respondents={results.respondents} multiple={Boolean(c.multiple)} />
    case 'yesno':
      return <YesNo counts={results.counts} respondents={results.respondents} />
    case 'scale':
      return <Scale min={c.min ?? 1} max={c.max ?? 5} minLabel={c.minLabel} maxLabel={c.maxLabel} distribution={results.distribution} average={results.average} respondents={results.respondents} />
    case 'wordcloud':
      return <WordCloud words={results.words} />
    case 'open':
      return <AnswerCards items={results.items} />
  }
}
