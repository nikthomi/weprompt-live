import type { Metadata } from 'next'
import { Praesentation } from './Praesentation'

export const metadata: Metadata = { title: 'Präsentation Kreativ-Challenge' }

export default function Page() {
  return <Praesentation />
}
