import { notFound } from 'next/navigation'
import { PresentationWindowButton } from '@/components/PresentationWindowButton'

/** Nur in der Entwicklung: Präsentationsfenster öffnen (zweiter Bildschirm, Hinweise). */
export default function Preview() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="min-h-dvh bg-mist p-10">
      <PresentationWindowButton url="/dev/vorschau" label="Präsentation öffnen" />
    </main>
  )
}
