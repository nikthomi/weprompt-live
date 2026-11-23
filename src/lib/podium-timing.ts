/**
 * Takt der Siegermelodie (public/sounds/sieger.mp3) für beide Podeste (Quiz und
 * Kreativ-Challenge): nach 2,3 s Aufbau drei Schläge «ta, ta, taaa» bei
 * 2,30 s, 4,47 s und 6,66 s. Platz 3, 2 und 1 landen je auf ihrem Schlag;
 * die Stufe wächst kurz vorher. Die Melodie klingt bis etwa 10,5 s aus.
 */
export const HITS = { third: 2.3, second: 4.47, first: 6.66 }
export const HIT_BY_PLACE = [HITS.first, HITS.second, HITS.third] // Index 0 = Platz 1
export const POP_PEAK = 0.42 // wp-pop erreicht seine volle Grösse nach 60 % von 0,7 s
export const AVATAR_AFTER_STEP = 0.55 // Gewinner springt auf die wachsende Stufe
export const stepAt = (hit: number) => hit - POP_PEAK - AVATAR_AFTER_STEP
/** Muh der Kuh, wenn die Melodie ausklingt (Kreativ-Challenge). */
export const MOO_AT = 9.4
