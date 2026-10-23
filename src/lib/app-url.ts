/** Öffentliche Adresse der App, ohne Schrägstrich am Ende. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://live.weprompt.ch').replace(/\/+$/, '')

export const joinUrl = (code: string) => `${APP_URL}/join/${code}`
export const presentUrl = (token: string) => `${APP_URL}/present/${token}`

/** Anzeigeform der Adresse ohne Protokoll, z. B. live.weprompt.ch/join/ABC123 */
export const shortJoinUrl = (code: string) => joinUrl(code).replace(/^https?:\/\//, '')
