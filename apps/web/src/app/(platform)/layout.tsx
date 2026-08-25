import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccountArea, AppShell, type NavSection } from '@/components/shell'
import { Icon } from '@/components/ui'
import { SignOutButton, getAuthorizationContext } from '@/features/identity'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Platform shell — visually distinct from the staff shell so an operator is
 * never in doubt which console they are in (Phase 5 §13.1). Platform
 * administration grants NO access to tenant data; support access arrives
 * later as a time-boxed, audited grant (Phase 4 §16.4).
 *
 * UI-B keeps that separation and stops relying on colour alone to carry it. The
 * sidebar is near-black rather than barangay green, which is the glance-level
 * cue — but an operator who is colour-blind, or simply moving fast between two
 * tabs, gets a banner under the topbar that says in words that this console
 * shows no resident data. The distinction matters most in exactly the moment
 * someone is least likely to study the chrome, so it is stated rather than
 * implied.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }
  if (!context.isPlatformAdmin) {
    redirect('/access-denied')
  }

  const sections: NavSection[] = [
    {
      title: 'Platform',
      items: [
        { href: '/platform', label: 'Overview', icon: 'home', exact: true },
        { href: '/dashboard', label: 'My dashboard', icon: 'user', exact: true },
      ],
    },
  ]

  return (
    <AppShell
      tone="dark"
      sections={sections}
      homeHref="/platform"
      context="Platform console"
      contentWidth="wide"
      account={
        <AccountArea name={context.displayName} secondary="Platform administrator" tone="inverse">
          <SignOutButton />
        </AccountArea>
      }
      banner={
        <div className="border-b border-neutral-800 bg-neutral-900 text-white">
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-4 py-2 sm:px-6">
            <Icon name="building" className="size-4" />
            <p className="text-dense">
              <span className="font-semibold">Platform console</span> — tenant administration only.
              No barangay resident data is shown here.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  )
}
