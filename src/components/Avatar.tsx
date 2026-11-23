/**
 * Quiz-Avatare: runde Tierbilder in public/avatars/<id>.webp (256 px, transparent
 * ausserhalb des Kreises). Die IDs müssen mit der Prüfung in live_set_profile übereinstimmen.
 */
export const AVATARS = [
  { id: 'kuh', label: 'Kuh' },
  { id: 'fuchs', label: 'Fuchs' },
  { id: 'katze', label: 'Katze' },
  { id: 'eule', label: 'Eule' },
  { id: 'baer', label: 'Bär' },
  { id: 'panda', label: 'Panda' },
  { id: 'frosch', label: 'Frosch' },
  { id: 'hase', label: 'Hase' },
  { id: 'pinguin', label: 'Pinguin' },
  { id: 'roboter', label: 'Roboter' },
  { id: 'koala', label: 'Koala' },
  { id: 'loewe', label: 'Löwe' },
] as const

export type AvatarId = (typeof AVATARS)[number]['id']

const IDS = new Set<string>(AVATARS.map(a => a.id))

export function isAvatar(id: string | null | undefined): id is AvatarId {
  return Boolean(id && IDS.has(id))
}

/** Runder Avatar; unbekannte IDs zeigen die Kuh. */
export function Avatar({ id, className = '', label }: { id: string | null | undefined; className?: string; label?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/avatars/${isAvatar(id) ? id : 'kuh'}.webp`} alt={label ?? ''} aria-hidden={label ? undefined : true}
      width={256} height={256} draggable={false} className={`rounded-full object-cover ${className}`} />
  )
}
