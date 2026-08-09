import type { ReactNode } from 'react'
import Link from 'next/link'

import { buttonClasses } from '@/components/ui'
import { BrandLockup } from './brand-lockup'

/**
 * The public portal shell (UI-B).
 *
 * The portal must NOT look like the authenticated application. Someone who has
 * never signed in should not be met with an admin console — and, more
 * practically, a green sidebar full of staff modules on a page that offers none
 * of them is an invitation to try the ones that are not there.
 *
 * So: no sidebar, no drawer, no JavaScript. Three destinations do not need a
 * disclosure widget, and the header wraps rather than collapsing — the whole
 * shell is static markup that works before hydration and would work without it.
 *
 * The green is restrained on purpose. A brand rule at the top edge, a brand
 * wordmark and one primary action; the rest is neutral, because the content is
 * the point. This shell is the frame only — the portal's own pages are UI-E.
 */

export type PublicShellProps = {
  children: ReactNode
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>

      {/* The one saturated brand element on the page. `brand-500` is the legacy
          hue and is used here exactly as DEC-UI-01 permits: a 3px decorative
          rule carrying no text and no meaning. */}
      <div className="from-brand-500 to-brand-700 h-[3px] bg-gradient-to-r" aria-hidden={true} />

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {/* `min-h-11` for the same reason as the console shells: the lockup's
              own content measures 43px, and this is a real navigation target. */}
          <Link href="/" className="rounded-control inline-flex min-h-11 items-center">
            <BrandLockup />
          </Link>
          <nav aria-label="Public" className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-control text-body-staff inline-flex min-h-11 items-center px-3 text-neutral-700 hover:bg-neutral-100"
            >
              Barangays
            </Link>
            <Link href="/sign-in" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              Sign in
            </Link>
            <Link href="/sign-up" className={buttonClasses({ size: 'sm' })}>
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <BrandLockup />
          <p className="text-dense max-w-prose text-neutral-500">
            Barangay Hub is the online counterpart of your barangay hall. Document details shown
            here are published by each barangay; confirm fees at the hall before paying.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link
              href="/"
              className="text-dense inline-flex min-h-11 items-center text-neutral-700 hover:underline"
            >
              Find a barangay
            </Link>
            <Link
              href="/sign-in"
              className="text-dense inline-flex min-h-11 items-center text-neutral-700 hover:underline"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-dense inline-flex min-h-11 items-center text-neutral-700 hover:underline"
            >
              Create an account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
