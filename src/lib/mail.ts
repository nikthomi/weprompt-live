import 'server-only'
import { Resend } from 'resend'
import { escapeHtml } from './html'

import { APP_URL } from './app-url'

let resend: Resend | null = null
function client() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt')
  resend ??= new Resend(process.env.RESEND_API_KEY)
  return resend
}

export function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.LIVE_FROM_EMAIL)
}

type MailBody = {
  preheader: string
  greeting: string
  paragraphs: string[]
  button?: { label: string; url: string }
  footnote?: string
}

/**
 * E-Mail im WePrompt-Design: violetter Grund, amber Sprechblase, coral Button.
 * Tabellen-Layout und Systemschrift, damit es auch in Outlook hält.
 */
export function renderMail(b: MailBody) {
  const p = b.paragraphs.map(t => `<p style="margin:0 0 14px;font-size:16px;line-height:24px;color:#1e1e1e;">${t}</p>`).join('')
  const button = b.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;"><tr><td style="border-radius:35px;background:#f64462;">
        <a href="${escapeHtml(b.button.url)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:35px;">${escapeHtml(b.button.label)}</a>
      </td></tr></table>`
    : ''
  const foot = b.footnote ? `<p style="margin:18px 0 0;font-size:13px;line-height:19px;color:#5f5f5f;">${b.footnote}</p>` : ''
  return `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WePrompt</title></head>
<body style="margin:0;padding:0;background:#6b11fe;font-family:Arial,Helvetica,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(b.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#6b11fe;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 0 22px;"><img src="${APP_URL}/brand/mail-logo.png" width="150" alt="WePrompt" style="display:block;border:0;"></td></tr>
    <tr><td style="background:#f6ca70;border-radius:25px 25px 25px 0;padding:30px 26px 20px;">
      <p style="margin:0 0 14px;font-size:18px;line-height:26px;font-weight:700;color:#1e1e1e;">${b.greeting}</p>
      ${p}${button}${foot}
    </td></tr>
    <tr><td style="padding:22px 4px 0;font-size:13px;line-height:19px;color:#ffffff;">
      WePrompt · Ein Angebot von deeds · <a href="https://weprompt.ch" style="color:#ffffff;">weprompt.ch</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`
}

export function renderText(b: MailBody) {
  const strip = (s: string) => s.replace(/<[^>]+>/g, '')
  return [strip(b.greeting), '', ...b.paragraphs.map(strip), '', b.button ? `${b.button.label}: ${b.button.url}` : '', b.footnote ? strip(b.footnote) : '']
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
}

export async function sendMail(to: string, subject: string, body: MailBody, opts: { idempotencyKey?: string; headers?: Record<string, string> } = {}) {
  const res = await client().emails.send(
    {
      from: process.env.LIVE_FROM_EMAIL!,
      to,
      subject,
      html: renderMail(body),
      text: renderText(body),
      headers: opts.headers,
    },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  )
  if (res.error) throw new Error(res.error.message)
  return res.data?.id ?? null
}
