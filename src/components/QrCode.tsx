'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** QR-Code als SVG. Schwarz auf weiss, damit jede Kamera ihn auch vom Beamer liest. */
export function QrCode({ url, className = '', label = 'QR-Code zur Teilnahme' }: { url: string; className?: string; label?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e1e1e', light: '#ffffff' } }).then(setSvg)
  }, [url])
  return (
    <div
      role="img"
      aria-label={label}
      className={`aspect-square bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      // Inhalt stammt aus der QR-Bibliothek, nicht aus Nutzereingaben.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export async function downloadQrPng(url: string, filename: string) {
  const dataUrl = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1e1e1e', light: '#ffffff' } })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
