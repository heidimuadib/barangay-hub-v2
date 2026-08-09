import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { AccountArea, AppShell } from '@/components/shell'
import {
  ACTIVE_BARANGAY_COOKIE,
  BarangaySwitcher,
  SignOutButton,
  getAuthorizationContext,
  hasStaffCapability,
  resolveActiveBarangay,
} from '@/features/identity'
import { formatRoleList } from '@/utils/format'
import { staffNavSections } from './staff-navigation'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Staff shell. Requires a session AND at least one active membership holding
 * a staff capability. As everywhere: this gate is convenience — every
 * mutation re-authorizes in the action chain and in RLS (Phase 4 DB-ADR-03).
 *
 * UI-B replaced the flat row of header links with the legacy dashboard's fixed
 * green sidebar. The capability rules are unchanged — `staffNavSections` makes
 * the same `can()` calls against the same permission constants as the row it
 * replaced. What changed is that the answers now group into sections and a
 * group disappears when it empties, so a clerk holding only `requests.read`
 * sees a short sidebar rather than headings with nothing under them.
 *
 * Certificates are deliberately absent: that navigation belongs to Slice 4,
 * paused at 4A on another branch, and an item here would point at a route this
 * branch does not contain.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }
  if (!hasStaffCapability(context)) {
    redirect('/access-denied')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)

  return (
    <AppShell
      tone="brand"
      sections={staffNavSections(context, active)}
      homeHref="/staff"
      context="Staff workspace"
      account={
        <AccountArea
          name={context.displayName}
          tone="inverse"
          {...(active
            ? {
                secondary:
                  active.roles.length > 0 ? formatRoleList(active.roles) : 'Barangay staff',
              }
            : {})}
        >
          <SignOutButton />
        </AccountArea>
      }
      {...(active
        ? {
            // The barangay name moves to the topbar and the role stays in the
            // account block, rather than both being crammed into one 16rem
            // line that truncated to "San Isidro (Test) · b…".
            topbarLabel: (
              <>
                Working in{' '}
                <span className="font-medium text-neutral-900">{active.barangayName}</span>
              </>
            ),
            topbarEnd: (
              <BarangaySwitcher
                memberships={context.memberships}
                activeBarangayId={active.barangayId}
              />
            ),
          }
        : {})}
    >
      {children}
    </AppShell>
  )
}
