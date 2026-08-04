import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  BarangaySwitcher,
  PERMISSIONS,
  SignOutButton,
  can,
  getAuthorizationContext,
  hasStaffCapability,
  resolveActiveBarangay,
} from '@/features/identity'
import { DOCUMENT_PERMISSIONS } from '@/features/documents'
import { REGISTRY_PERMISSIONS } from '@/features/registry'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Staff shell. Requires a session AND at least one active membership holding
 * a staff capability. As everywhere: this gate is convenience — every
 * mutation re-authorizes in the action chain and in RLS (Phase 4 DB-ADR-03).
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
    <>
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-4">
            <Link
              href="/staff"
              className="text-brand-700 inline-flex min-h-11 items-center font-semibold"
            >
              Barangay Hub · Staff
            </Link>
            <Link
              href="/staff"
              className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
            >
              Workspace
            </Link>
            {active && can(context, active.barangayId, REGISTRY_PERMISSIONS.registryRead) ? (
              <Link
                href="/staff/registry"
                className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
              >
                Registry
              </Link>
            ) : null}
            {active && can(context, active.barangayId, REGISTRY_PERMISSIONS.verificationRead) ? (
              <Link
                href="/staff/verification"
                className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
              >
                Verification
              </Link>
            ) : null}
            {active && can(context, active.barangayId, DOCUMENT_PERMISSIONS.requestsRead) ? (
              <Link
                href="/staff/requests"
                className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
              >
                Requests
              </Link>
            ) : null}
            {active && can(context, active.barangayId, PERMISSIONS.membershipRead) ? (
              <Link
                href="/staff/members"
                className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
              >
                Members
              </Link>
            ) : null}
            {active && can(context, active.barangayId, PERMISSIONS.auditRead) ? (
              <Link
                href="/staff/audit"
                className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
              >
                Audit log
              </Link>
            ) : null}
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center text-sm text-neutral-700 hover:underline"
            >
              My dashboard
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            {active ? (
              <>
                <p className="text-sm text-neutral-500">
                  Working in{' '}
                  <span className="font-medium text-neutral-900">{active.barangayName}</span>
                </p>
                <BarangaySwitcher
                  memberships={context.memberships}
                  activeBarangayId={active.barangayId}
                />
              </>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </>
  )
}
