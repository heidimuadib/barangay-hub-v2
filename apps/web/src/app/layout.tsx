import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import '@/styles/globals.css'
import '@/styles/print.css'

/**
 * Inter, self-hosted from a committed woff2 (UI-A / DEC-UI-01).
 *
 * `--font-sans` in `globals.css` has named Inter since Slice 0a, but nothing
 * loaded it, so the whole application rendered in the OS fallback. It is loaded
 * here rather than from a CDN because `middleware.ts` sets `font-src 'self'`;
 * see `src/fonts/README.md` for the provenance of the file and why it is
 * committed instead of installed.
 *
 * `adjustFontFallback` generates a metrically-adjusted Arial fallback, so the
 * swap from fallback to Inter does not reflow the page — which matters most on
 * the slow connections this product is used on.
 */
const inter = localFont({
  src: '../fonts/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
})

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
  // Matches `brand-700`, the shade that actually carries the browser chrome
  // against white UI — not the decorative legacy `brand-500`.
  themeColor: '#15603f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
