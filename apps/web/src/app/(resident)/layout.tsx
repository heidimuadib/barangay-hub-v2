import type { Metadata } from 'next'

import { AccountArea, AppShell, type NavSection } from '@/components/shell'
import { SignOutButton, getAuthorizationContext, hasStaffCapability } from '@/features/identity'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  // Everything behind a resident session is private.
  robots: { index: false, follow: false },
}

/**
 * Resident shell. The session check here is a defence-in-depth convenience —
 * the authorization boundary is the Server Action chain and RLS
 * (Phase 3 ADR-01, Phase 6 §25.1). The middleware performs the same bounce
 * one layer earlier.
 *
 * UI-B gives residents the same shell as staff on a `light` surface rather than
 * the saturated green one. The structure is shared because the problem is
 * shared — five destinations, a current one, and a phone — but the weight is
 * not: a resident checking whether their barangay clearance is ready is a
 * visitor, and meeting them with the full staff console says they are at work.
 * White sidebar, brand-green current state, larger body type
 * (`text-body-resident` is 17px against staff's 16px, UX-ADR-14).
 *
 * Everything here is personal, so nothing is capability-gated: a signed-in
 * resident may always reach their own documents, requests and account. The two
 * cross-console links at the bottom are the exception, and they are the same
 * `hasStaffCapability` / `isPlatformAdmin` checks the header row used.
 */
export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const sections: NavSection[] = [
    {
      title: 'My barangay',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'home', exact: true },
        { href: '/documents', label: 'Documents', icon: 'file-text' },
        { href: '/requests', label: 'My requests', icon: 'inbox' },
      ],
    },
    {
      title: 'My account',
      items: [
        { href: '/verification', label: 'Verification', icon: 'shield-check' },
        { href: '/account', label: 'Account details', icon: 'user' },
      ],
    },
    {
      title: 'Consoles',
      items: [
        ...(hasStaffCapability(context)
          ? [{ href: '/staff', label: 'Staff workspace', icon: 'building' as const, exact: true }]
          : []),
        ...(context.isPlatformAdmin
          ? [
              {
                href: '/platform',
                label: 'Platform console',
                icon: 'scroll-text' as const,
                exact: true,
              },
            ]
          : []),
      ],
    },
  ]

  return (
    <AppShell
      tone="light"
      sections={sections}
      homeHref="/dashboard"
      contentWidth="narrow"
      account={
        <AccountArea name={context.displayName} tone="default">
          <SignOutButton />
        </AccountArea>
      }
    >
      {children}
    </AppShell>
  )
}
