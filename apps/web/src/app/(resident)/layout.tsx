import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignOutButton, getAuthorizationContext, hasStaffCapability } from '@/features/identity'

export const metadata: Metadata = {
  // Everything behind a resident session is private.
  robots: { index: false, follow: false },
}

/**
 * Resident shell. The session check here is a defence-in-depth convenience —
 * the authorization boundary is the Server Action chain and RLS
 * (Phase 3 ADR-01, Phase 6 §25.1). The middleware performs the same bounce
 * one layer earlier.
 */
export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  return (
    <>
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="text-brand-700 inline-flex min-h-11 items-center font-semibold"
            >
              Barangay Hub
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
            >
              Dashboard
            </Link>
            <Link
              href="/documents"
              className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
            >
              Documents
            </Link>
            <Link
              href="/requests"
              className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
            >
              My requests
            </Link>
            <Link
              href="/account"
              className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
            >
              My account
            </Link>
            {hasStaffCapability(context) ? (
              <Link
                href="/staff"
                className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
              >
                Staff workspace
              </Link>
            ) : null}
            {context.isPlatformAdmin ? (
              <Link
                href="/platform"
                className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
              >
                Platform console
              </Link>
            ) : null}
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
        {children}
      </main>
    </>
  )
}
