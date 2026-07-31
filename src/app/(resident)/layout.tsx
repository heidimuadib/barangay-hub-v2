import type { Metadata } from 'next'

export const metadata: Metadata = {
  // Everything behind a resident session is private.
  robots: { index: false, follow: false },
}

/**
 * Resident shell placeholder.
 *
 * The real ResidentShell — bottom navigation on mobile, sidebar on desktop,
 * notification centre, verification-status banner — is built in Slice 1 /
 * US-UI-002.
 *
 * NOTE: this layout performs no authentication check. Route protection belongs
 * to the Server Action chain and to RLS, not to a layout — a layout that gates
 * rendering only hides the interface, it does not protect the data
 * (Phase 3 ADR-01, Phase 6 §25.1). Session-based route gating lands in Slice 1
 * as a defence-in-depth convenience, never as the authorization boundary.
 */
export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <main id="main" className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
        {children}
      </main>
    </>
  )
}
