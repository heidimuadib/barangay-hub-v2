import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Platform shell placeholder.
 *
 * Visually distinct from the staff shell by design — a platform administrator
 * must never be in doubt about which console they are operating in
 * (Phase 5 §13.1). The distinguishing chrome is added in Slice 1 / US-UI-002.
 *
 * Platform administration never grants implicit access to tenant data. Support
 * access requires a time-boxed, audited grant (Phase 4 §16.4).
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </>
  )
}
