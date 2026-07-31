import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Staff shell placeholder.
 *
 * The real StaffShell — persistent sidebar, tenant indicator, queue counts,
 * global search, and the density controls that make an 8-hour counter shift
 * workable (Phase 5 §12) — is built in Slice 1 / US-UI-002.
 *
 * As with the resident shell, this layout performs no authorization. Staff
 * permissions resolve live from the database on every mutation (Phase 4
 * DB-ADR-03); a layout check would be both redundant and unsafe to rely on.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </>
  )
}
