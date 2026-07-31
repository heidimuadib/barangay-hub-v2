import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getAuthorizationContext } from '@/features/identity'

export const metadata: Metadata = {
  title: 'My dashboard',
  robots: { index: false, follow: false },
}

const STATUS_COPY = {
  active: 'Active member',
  invited: 'Invitation pending — ask your barangay to activate it',
  disabled: 'Membership disabled',
} as const

/**
 * Slice 1 resident dashboard: proves the session and membership context
 * end-to-end. The real dashboard content (requests, announcements) is
 * Slice 3 / US-RES-004.
 */
export default async function ResidentDashboardPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h1 className="text-xl font-bold">Welcome, {context.displayName}</h1>
        <p className="mt-2 text-neutral-700">
          Document requests and barangay services arrive in a later update. Your account and
          barangay membership below are live.
        </p>
      </div>

      <section
        aria-labelledby="memberships-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="memberships-heading" className="text-lg font-bold">
          Your barangay memberships
        </h2>
        {context.memberships.length === 0 ? (
          <p className="mt-3 text-neutral-700">
            Your account is not yet a member of any barangay. Contact your barangay office to be
            added.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {context.memberships.map((membership) => (
              <li
                key={membership.membershipId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-4 py-3"
              >
                <span className="font-medium text-neutral-900">{membership.barangayName}</span>
                <span className="text-sm text-neutral-500">{STATUS_COPY[membership.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
