const dateFmt = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' })
const dateTimeFmt = new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })

export const formatDate = (d: string | Date) => dateFmt.format(typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d)
export const formatDateTime = (d: string | Date) => dateTimeFmt.format(typeof d === 'string' ? new Date(d) : d)

/** Prozent ohne Nachkommastellen, 0 bei 0 Stimmen. */
export const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
