import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignOutButton, getAuthorizationContext } from '@/features/identity'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Platform shell — visually distinct from the staff shell so an operator is
 * never in doubt which console they are in (Phase 5 §13.1). Platform
 * administration grants NO access to tenant data; support access arrives
 * later as a time-boxed, audited grant (Phase 4 §16.4).
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }
  if (!context.isPlatformAdmin) {
    redirect('/access-denied')
  }

  return (
    <>
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <header className="border-b-4 border-neutral-900 bg-neutral-900 text-white">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-4">
            <Link
              href="/platform"
              className="inline-flex min-h-11 items-center font-semibold text-white"
            >
              Barangay Hub · Platform console
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center text-sm text-neutral-200 hover:underline"
            >
              My dashboard
            </Link>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </>
  )
}
