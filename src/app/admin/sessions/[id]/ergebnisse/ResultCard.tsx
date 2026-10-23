'use client'

import { useRef } from 'react'
import { ExportPng, pngName } from '@/components/ExportPng'
import { ResultView } from '@/components/results/ResultView'
import { typeLabel, type Question, type Results } from '@/lib/types'

/** Eine Frage mit Ergebnis als kleine Bühne (exportierbar als PNG). */
export function ResultCard({ question, number, results, sessionTitle }: { question: Question; number: number; results: Results | null; sessionTitle: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const extra = results?.type === 'open' ? results.items.filter(i => i.status !== 'visible').length : 0
  return (
    <article className="panel flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-small text-gray">Frage {number} · {typeLabel(question.type)} · {results?.respondents ?? 0} {results?.respondents === 1 ? 'Antwort' : 'Antworten'}{extra ? ` (davon ${extra} nicht freigegeben)` : ''}</p>
          <h2 className="t-h3 mt-1 [overflow-wrap:anywhere]">{question.title}</h2>
        </div>
        {results?.respondents ? <ExportPng target={ref} filename={pngName(sessionTitle, `frage-${number}`)} /> : null}
      </div>
      <div ref={ref} className="stage aspect-video w-full overflow-hidden rounded-[14px] bg-violett">
        <div className="flex h-full flex-col px-[4.5cqw] py-[4cqh]">
          <p className="stage-title !text-[clamp(16px,3.2cqw,64px)] text-white">{question.title}</p>
          <div className="stage relative mt-[3cqh] min-h-0 flex-1">
            <ResultView question={question} results={results} />
          </div>
        </div>
      </div>
    </article>
  )
}
