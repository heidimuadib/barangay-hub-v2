import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAuthorizationContext } from '@/features/identity'
import { VerificationStatusBadge, getOwnRegistryState } from '@/features/registry'
import type { VerificationState } from '@/features/registry'

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

  const registry = await getOwnRegistryState()

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h1 className="text-xl font-bold">Welcome, {context.displayName}</h1>
        <p className="mt-2 text-neutral-700">
          Document requests and barangay services arrive in a later update. Your account and
          barangay membership below are live.
        </p>
      </div>

      {/* Verification card: the single next action for a resident who has not
          finished registering, and a status readout once they have. */}
      <section
        aria-labelledby="verification-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="verification-heading" className="text-lg font-bold">
            Resident registration
          </h2>
          {registry?.state ? (
            <VerificationStatusBadge state={registry.state as VerificationState} />
          ) : null}
        </div>

        {registry === null ? (
          <>
            <p className="mt-3 text-neutral-700">
              You have not registered as a resident yet. Registering lets your barangay confirm who
              you are before you request documents.
            </p>
            <Link
              href="/onboarding"
              className="bg-brand-700 hover:bg-brand-800 mt-4 inline-block min-h-11 rounded-md px-4 py-2 font-medium text-white"
            >
              Start my registration
            </Link>
          </>
        ) : (
          <>
            <p className="mt-3 text-neutral-700">
              Registered with <span className="font-medium">{registry.barangay_name}</span>.
            </p>
            {/* Same 44px target as its sibling CTA above: this is the
                resident's primary next action once registered, and it was
                sitting at 27px (Slice 2G accessibility review). */}
            <Link
              href="/verification"
              className="text-brand-700 mt-3 inline-flex min-h-11 items-center underline"
            >
              View my registration
            </Link>
          </>
        )}
      </section>

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
