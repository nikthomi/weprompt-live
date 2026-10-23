'use client'

import { useState } from 'react'
import { QrCode, downloadQrPng } from '@/components/QrCode'

export function JoinPanel({ code, url, label, title }: { code: string; url: string; label: string; title: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const file = `QR_${title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}_${code}.png`
  return (
    <section className="panel" aria-labelledby="join-h">
      <h2 id="join-h" className="t-h3">Teilnahme</h2>
      <div className="mt-4 flex items-center gap-5">
        <QrCode url={url} className="w-[132px] shrink-0 rounded-[12px] border border-black/10 p-1.5" />
        <div className="min-w-0">
          <p className="t-small text-gray">Code</p>
          <p className="font-[family-name:var(--font-brand)] text-[34px] font-bold leading-none tracking-[.12em]">{code}</p>
          <p className="t-small mt-3 break-all">{label}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="wp-btn-quiet" onClick={copy} aria-live="polite">{copied ? 'Kopiert' : 'Link kopieren'}</button>
        <button type="button" className="wp-btn-quiet" onClick={() => downloadQrPng(url, file)}>QR als PNG</button>
      </div>
    </section>
  )
}
