import type { ReactNode } from 'react'

/**
 * Quiz-Avatare: flache Tierköpfe in den WePrompt-Farben, ohne Schatten und
 * Verläufe. Die IDs müssen mit der Prüfung in live_set_profile übereinstimmen.
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

const K = '#1E1E1E'
const W = '#FFFFFF'
const MIST = '#F2F0ED'
const AMBER = '#F6CA70'
const CORAL = '#F64462'
const ROSE = '#F9A8B6'
const ORANGE = '#F08A3E'
const BROWN = '#A8744A'
const GREEN = '#7CC47F'
const GRAY = '#A3A7AE'

const eyes = (y = 50, dx = 13, r = 5, fill = K) => (
  <>
    <circle cx={50 - dx} cy={y} r={r} fill={fill} />
    <circle cx={50 + dx} cy={y} r={r} fill={fill} />
  </>
)

const FACES: Record<AvatarId, { bg: string; face: ReactNode }> = {
  kuh: {
    bg: AMBER,
    face: (
      <>
        <path d="M24 30 C16 22 16 14 22 12 C24 20 28 24 32 26Z" fill={W} />
        <path d="M76 30 C84 22 84 14 78 12 C76 20 72 24 68 26Z" fill={W} />
        <ellipse cx="18" cy="42" rx="10" ry="6" fill={W} transform="rotate(-20 18 42)" />
        <ellipse cx="82" cy="42" rx="10" ry="6" fill={W} transform="rotate(20 82 42)" />
        <ellipse cx="50" cy="52" rx="28" ry="32" fill={W} />
        <path d="M30 34 C36 28 44 32 42 40 C40 46 32 44 30 34Z" fill={K} />
        <path d="M66 54 C72 50 78 56 76 62 C72 66 64 62 66 54Z" fill={K} />
        {eyes(48, 12, 4.5)}
        <ellipse cx="50" cy="70" rx="20" ry="13" fill={ROSE} />
        <ellipse cx="43" cy="70" rx="3" ry="4" fill={K} />
        <ellipse cx="57" cy="70" rx="3" ry="4" fill={K} />
      </>
    ),
  },
  fuchs: {
    bg: MIST,
    face: (
      <>
        <path d="M20 16 L40 34 L26 50Z" fill={ORANGE} />
        <path d="M80 16 L60 34 L74 50Z" fill={ORANGE} />
        <path d="M24 24 L34 34 L27 42Z" fill={K} />
        <path d="M76 24 L66 34 L73 42Z" fill={K} />
        <path d="M18 42 C18 30 34 26 50 26 C66 26 82 30 82 42 C82 60 64 82 50 86 C36 82 18 60 18 42Z" fill={ORANGE} />
        <path d="M18 48 C28 52 40 58 50 86 C36 82 20 64 18 48Z" fill={W} />
        <path d="M82 48 C72 52 60 58 50 86 C64 82 80 64 82 48Z" fill={W} />
        {eyes(50, 13, 4.5)}
        <ellipse cx="50" cy="78" rx="5" ry="4" fill={K} />
      </>
    ),
  },
  katze: {
    bg: AMBER,
    face: (
      <>
        <path d="M20 18 L42 32 L22 48Z" fill={K} />
        <path d="M80 18 L58 32 L78 48Z" fill={K} />
        <path d="M25 26 L36 33 L26 41Z" fill={ROSE} />
        <path d="M75 26 L64 33 L74 41Z" fill={ROSE} />
        <ellipse cx="50" cy="54" rx="32" ry="30" fill={K} />
        <ellipse cx="37" cy="50" rx="7" ry="8" fill={AMBER} />
        <ellipse cx="63" cy="50" rx="7" ry="8" fill={AMBER} />
        <ellipse cx="37" cy="50" rx="2.5" ry="6" fill={K} />
        <ellipse cx="63" cy="50" rx="2.5" ry="6" fill={K} />
        <path d="M45 64 L55 64 L50 70Z" fill={ROSE} />
        <path d="M30 66 L12 62 M30 70 L12 72 M70 66 L88 62 M70 70 L88 72" stroke={W} strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  eule: {
    bg: MIST,
    face: (
      <>
        <path d="M22 22 L36 32 L24 40Z" fill={BROWN} />
        <path d="M78 22 L64 32 L76 40Z" fill={BROWN} />
        <ellipse cx="50" cy="56" rx="32" ry="32" fill={BROWN} />
        <ellipse cx="50" cy="66" rx="20" ry="20" fill={AMBER} />
        <circle cx="36" cy="48" r="13" fill={W} />
        <circle cx="64" cy="48" r="13" fill={W} />
        <circle cx="36" cy="48" r="6" fill={K} />
        <circle cx="64" cy="48" r="6" fill={K} />
        <path d="M44 58 L56 58 L50 70Z" fill={ORANGE} />
      </>
    ),
  },
  baer: {
    bg: AMBER,
    face: (
      <>
        <circle cx="24" cy="26" r="12" fill={BROWN} />
        <circle cx="76" cy="26" r="12" fill={BROWN} />
        <circle cx="24" cy="26" r="6" fill={ROSE} />
        <circle cx="76" cy="26" r="6" fill={ROSE} />
        <circle cx="50" cy="54" r="34" fill={BROWN} />
        <ellipse cx="50" cy="68" rx="16" ry="12" fill={MIST} />
        {eyes(48, 13, 4.5)}
        <ellipse cx="50" cy="63" rx="6" ry="4.5" fill={K} />
        <path d="M44 72 C47 75 53 75 56 72" stroke={K} strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  panda: {
    bg: GREEN,
    face: (
      <>
        <circle cx="24" cy="26" r="12" fill={K} />
        <circle cx="76" cy="26" r="12" fill={K} />
        <circle cx="50" cy="54" r="34" fill={W} />
        <ellipse cx="36" cy="50" rx="9" ry="11" fill={K} transform="rotate(25 36 50)" />
        <ellipse cx="64" cy="50" rx="9" ry="11" fill={K} transform="rotate(-25 64 50)" />
        <circle cx="37" cy="49" r="3.5" fill={W} />
        <circle cx="63" cy="49" r="3.5" fill={W} />
        <ellipse cx="50" cy="66" rx="6" ry="4.5" fill={K} />
        <path d="M45 73 C48 76 52 76 55 73" stroke={K} strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  frosch: {
    bg: AMBER,
    face: (
      <>
        <circle cx="32" cy="34" r="14" fill={GREEN} />
        <circle cx="68" cy="34" r="14" fill={GREEN} />
        <ellipse cx="50" cy="60" rx="36" ry="26" fill={GREEN} />
        <circle cx="32" cy="34" r="8" fill={W} />
        <circle cx="68" cy="34" r="8" fill={W} />
        <circle cx="33" cy="35" r="4.5" fill={K} />
        <circle cx="67" cy="35" r="4.5" fill={K} />
        <path d="M30 64 C40 74 60 74 70 64" stroke={K} strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="26" cy="62" r="4" fill={ROSE} />
        <circle cx="74" cy="62" r="4" fill={ROSE} />
      </>
    ),
  },
  hase: {
    bg: ROSE,
    face: (
      <>
        <ellipse cx="36" cy="22" rx="8" ry="20" fill={MIST} />
        <ellipse cx="64" cy="22" rx="8" ry="20" fill={MIST} />
        <ellipse cx="36" cy="22" rx="4" ry="14" fill={CORAL} />
        <ellipse cx="64" cy="22" rx="4" ry="14" fill={CORAL} />
        <ellipse cx="50" cy="60" rx="30" ry="28" fill={MIST} />
        {eyes(54, 12, 4.5)}
        <path d="M46 64 L54 64 L50 68Z" fill={CORAL} />
        <path d="M50 68 L50 72 M50 72 C47 75 44 74 43 72 M50 72 C53 75 56 74 57 72" stroke={K} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="32" cy="66" r="4" fill={ROSE} />
        <circle cx="68" cy="66" r="4" fill={ROSE} />
      </>
    ),
  },
  pinguin: {
    bg: AMBER,
    face: (
      <>
        <ellipse cx="50" cy="54" rx="34" ry="34" fill={K} />
        <path d="M50 38 C38 30 24 38 24 54 C24 72 38 84 50 84 C62 84 76 72 76 54 C76 38 62 30 50 38Z" fill={W} />
        {eyes(52, 11, 4.5)}
        <path d="M42 62 L58 62 L50 70Z" fill={ORANGE} />
        <circle cx="30" cy="64" r="4" fill={ROSE} />
        <circle cx="70" cy="64" r="4" fill={ROSE} />
      </>
    ),
  },
  roboter: {
    bg: MIST,
    face: (
      <>
        <path d="M50 12 L50 24" stroke={K} strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="12" r="5" fill={CORAL} />
        <rect x="14" y="44" width="8" height="18" rx="3" fill={K} />
        <rect x="78" y="44" width="8" height="18" rx="3" fill={K} />
        <rect x="20" y="24" width="60" height="58" rx="14" fill={GRAY} />
        <rect x="28" y="36" width="44" height="22" rx="10" fill={K} />
        <circle cx="40" cy="47" r="5" fill={AMBER} />
        <circle cx="60" cy="47" r="5" fill={AMBER} />
        <rect x="36" y="66" width="28" height="6" rx="3" fill={K} />
        <path d="M43 66 L43 72 M50 66 L50 72 M57 66 L57 72" stroke={GRAY} strokeWidth="2" />
      </>
    ),
  },
  koala: {
    bg: AMBER,
    face: (
      <>
        <circle cx="20" cy="38" r="17" fill={GRAY} />
        <circle cx="80" cy="38" r="17" fill={GRAY} />
        <circle cx="20" cy="38" r="9" fill={MIST} />
        <circle cx="80" cy="38" r="9" fill={MIST} />
        <ellipse cx="50" cy="56" rx="30" ry="30" fill={GRAY} />
        {eyes(50, 13, 4.5)}
        <ellipse cx="50" cy="64" rx="8" ry="11" fill={K} />
        <path d="M44 78 C47 80 53 80 56 78" stroke={K} strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  loewe: {
    bg: MIST,
    face: (
      <>
        <circle cx="50" cy="52" r="38" fill={ORANGE} />
        <path d="M50 14 L58 22 L68 16 L72 27 L83 26 L82 37 L90 44 L84 52 L90 60 L82 66 L83 78 L72 77 L68 88 L58 82 L50 90 L42 82 L32 88 L28 77 L17 78 L18 66 L10 60 L16 52 L10 44 L18 37 L17 26 L28 27 L32 16 L42 22Z" fill={ORANGE} />
        <circle cx="30" cy="32" r="7" fill={AMBER} />
        <circle cx="70" cy="32" r="7" fill={AMBER} />
        <circle cx="50" cy="54" r="26" fill={AMBER} />
        {eyes(50, 11, 4)}
        <path d="M44 60 L56 60 L50 66Z" fill={K} />
        <path d="M50 66 L50 70 M50 70 C47 73 44 72 43 70 M50 70 C53 73 56 72 57 70" stroke={K} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
}

export function isAvatar(id: string | null | undefined): id is AvatarId {
  return Boolean(id && id in FACES)
}

/** Runder Avatar; unbekannte IDs zeigen die Kuh. */
export function Avatar({ id, className = '', label }: { id: string | null | undefined; className?: string; label?: string }) {
  const f = FACES[isAvatar(id) ? id : 'kuh']
  return (
    <svg viewBox="0 0 100 100" className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="50" cy="50" r="50" fill={f.bg} />
      <g>{f.face}</g>
    </svg>
  )
}
