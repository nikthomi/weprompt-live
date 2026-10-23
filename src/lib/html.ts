/** Für Text in HTML-Mails. In React-Komponenten nie nötig, dort escaped React selbst. */
export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
