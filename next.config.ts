import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // Admin und Teilnahme dürfen nicht eingebettet werden (Clickjacking).
      { source: '/((?!present/).*)', headers: [...securityHeaders, { key: 'X-Frame-Options', value: 'DENY' }] },
      // Beamer-Ansicht darf eingebettet werden (z. B. in eine Präsentation), verrät aber nie den Token weiter.
      { source: '/present/:path*', headers: [...securityHeaders.filter(h => h.key !== 'Referrer-Policy'), { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ]
  },
}

export default nextConfig
