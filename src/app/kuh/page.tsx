import type { Metadata } from 'next'
import { KuhApp } from './KuhApp'

export const metadata: Metadata = {
  title: { absolute: 'Die Kuh muss auf die Alp! · WePrompt' },
  description: 'Kreativ-Challenge: Bild hochladen und alle Ergebnisse in der Galerie ansehen.',
}

export default function Page() {
  return <KuhApp />
}
