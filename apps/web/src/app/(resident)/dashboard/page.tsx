import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { Badge, Card, CardBody, CardHeader, PageHeader, buttonClasses } from '@/components/ui'
import {
  ACTIVE_BARANGAY_COOKIE,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import { RequestStateChip, listOwnRequestPage } from '@/features/documents'
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
 * Resident dashboard.
 *
 * Slice 1 proved the session and membership context here; Slice 3B makes
 * US-RES-004 real by adding the resident's own document requests. The request
 * card is the resident's tracker: the most recent few, with the same status
 * vocabulary the request list and detail use.
 */
export default async function ResidentDashboardPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)

  const [registry, requests] = await Promise.all([
    getOwnRegistryState(),
    // No active membership means no tenant to scope requests to — the card
    // below simply does not appear, rather than guessing a barangay.
    active ? listOwnRequestPage(active.barangayId, 1) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${context.displayName}`}
        description="Your account, barangay membership, and document requests are organized below."
      />

      {/* Verification card: the single next action for a resident who has not
          finished registering, and a status readout once they have. */}
      <section aria-labelledby="verification-heading">
        <Card accent={registry?.state === 'approved'}>
          <CardHeader
            id="verification-heading"
            as="h2"
            title="Resident registration"
            action={
              registry?.state ? (
                <VerificationStatusBadge state={registry.state as VerificationState} />
              ) : (
                <Badge tone="warning">Not registered</Badge>
              )
            }
          />
          <CardBody>
            {registry === null ? (
              <div className="space-y-4">
                <p className="text-neutral-700">
                  You have not registered as a resident yet. Registering lets your barangay confirm
                  who you are before you request documents.
                </p>
                <div>
                  <Link href="/onboarding" className={buttonClasses({ variant: 'primary' })}>
                    Start my registration
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-neutral-700">
                  Registered with{' '}
                  <span className="font-semibold text-neutral-900">{registry.barangay_name}</span>.
                </p>
                <div>
                  <Link
                    href="/verification"
                    className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center font-medium underline underline-offset-2"
                  >
                    View my registration &rarr;
                  </Link>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      {requests === null ? null : (
        <section aria-labelledby="requests-heading">
          <Card>
            <CardHeader
              id="requests-heading"
              as="h2"
              title="My document requests"
              action={
                <Link
                  href="/documents"
                  className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                >
                  Request a document
                </Link>
              }
            />
            <CardBody>
              {requests.entries.length === 0 ? (
                <p className="text-neutral-600">
                  You have not requested any documents yet. Browse what your barangay offers to get
                  started.
                </p>
              ) : (
                <div className="space-y-4">
                  <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
                    {requests.entries.slice(0, 3).map((entry) => (
                      <li
                        key={entry.requestId}
                        className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-neutral-50"
                      >
                        <Link
                          href={`/requests/${entry.requestId}`}
                          className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center font-medium hover:underline"
                        >
                          {entry.documentTypeName ?? 'Document no longer offered'}
                        </Link>
                        <RequestStateChip state={entry.state} />
                      </li>
                    ))}
                  </ul>
                  <div>
                    <Link
                      href="/requests"
                      className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center font-medium underline underline-offset-2"
                    >
                      See all {requests.total} request{requests.total === 1 ? '' : 's'} &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </section>
      )}

      <section aria-labelledby="memberships-heading">
        <Card>
          <CardHeader
            id="memberships-heading"
            as="h2"
            title="Your barangay memberships"
            description="Barangays you are affiliated with for citizen services."
          />
          <CardBody>
            {context.memberships.length === 0 ? (
              <p className="text-neutral-600">
                Your account is not yet a member of any barangay. Contact your barangay office to be
                added.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
                {context.memberships.map((membership) => (
                  <li
                    key={membership.membershipId}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <span className="font-semibold text-neutral-900">
                      {membership.barangayName}
                    </span>
                    <Badge
                      tone={
                        membership.status === 'active'
                          ? 'success'
                          : membership.status === 'invited'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {STATUS_COPY[membership.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
