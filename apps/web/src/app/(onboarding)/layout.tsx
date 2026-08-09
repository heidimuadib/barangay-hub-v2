import type { Metadata } from 'next'

import { BrandLockup } from '@/components/shell'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Onboarding shell (UI-B).
 *
 * Onboarding used to sit inside the resident group and would therefore have
 * inherited the resident sidebar. It is moved into its own group instead — the
 * URL is unchanged, because a route group is not part of the path — so that it
 * can be a focused, single-task page.
 *
 * The reason is not aesthetic. A resident on this page has no registry record
 * yet: that is the definition of the state, and the page redirects to
 * `/verification` the moment one exists. Every destination the resident sidebar
 * offers is therefore either empty or a redirect back to here. Navigation whose
 * every branch is a dead end is worse than no navigation, so the shell shows the
 * brand, the task, and nothing else.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-[720px] px-4 py-4 sm:px-6">
          <BrandLockup />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
