import type { Metadata, Viewport } from 'next'

import '@/styles/globals.css'
import '@/styles/print.css'

export const metadata: Metadata = {
  title: {
    default: 'Barangay Hub',
    template: '%s · Barangay Hub',
  },
  description: 'Request barangay documents, track requests, and verify certificates online.',
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Not set to a maximum — pinch zoom must remain available (Phase 5 §33).
  themeColor: '#0e5d52',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
