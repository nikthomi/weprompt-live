/**
 * CSV für Excel (Schweiz): Semikolon, UTF-8 mit BOM. Zellen, die mit = + - @
 * beginnen, werden entschärft, damit Excel sie nicht als Formel ausführt.
 */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n'
}

export function csvFilename(title: string, kind: string) {
  const slug = title.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60)
  return `weprompt-live_${slug || 'session'}_${kind}.csv`
}
