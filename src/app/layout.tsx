import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter } from 'next/font/google'
import './globals.css'

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'WePrompt Live', template: '%s · WePrompt Live' },
  description: 'Live abstimmen im WePrompt-Workshop: Code eingeben oder QR-Code scannen.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: '#6b11fe', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de-CH" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
