import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  can,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import { DOCUMENT_PERMISSIONS } from '@/features/documents'
import {
  DuplicateResolutionPanel,
  REGISTRY_PERMISSIONS,
  RESIDENCY_BASES,
  getDuplicateReview,
} from '@/features/registry'

export const metadata: Metadata = {
  title: 'Resident record',
  robots: { index: false, follow: false },
}

/**
 * Safe staff view of one resident record (Slice 2C), now hosting the
 * duplicate review and resolution surface (Slice 2E).
 *
 * Shows only what counter work needs: identity fields, account linkage,
 * verification status, residency basis, superseded state and the duplicate
 * comparison. Evidence DOCUMENTS are not reachable here — that surface
 * arrives with the Storage broker in subpart 2F and behind
 * `verification.evidence.read`.
 *
 * The URL carries an opaque person UUID and nothing else (P6-C-E).
 */
export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>
}) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, REGISTRY_PERMISSIONS.registryRead)) {
    redirect('/access-denied')
  }

  const { personId } = await params
  const review = await getDuplicateReview(active.barangayId, personId)
  // A record in another barangay is indistinguishable from one that does not
  // exist (Phase 4 §13.6) — RLS returns nothing either way.
  if (!review) {
    notFound()
  }
  const person = review.entry
  // Resolution is administrator-only under the D2-04 mapping; the database
  // re-checks regardless of what this page renders.
  const canResolve = can(context, active.barangayId, REGISTRY_PERMISSIONS.resolveDuplicates)
  const canFileRequest = can(context, active.barangayId, DOCUMENT_PERMISSIONS.createWalkIn)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">{person.fullName}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {active.barangayName} ·{' '}
          {person.sourceChannel === 'staff' ? 'recorded by staff (walk-in)' : 'self-registered'}
        </p>
      </div>

      {person.superseded ? (
        <p
          role="status"
          className="border-warning-100 rounded-lg border bg-white p-4 text-neutral-700"
        >
          This record was superseded during duplicate resolution. It is kept for history and cannot
          be edited.
          {review.supersededBy ? (
            <>
              {' '}
              The surviving record is{' '}
              <Link
                href={`/staff/registry/${review.supersededBy.personId}`}
                className="text-brand-700 underline"
              >
                {review.supersededBy.fullName}
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}

      {review.absorbed.length > 0 ? (
        <section
          aria-labelledby="absorbed-heading"
          className="rounded-lg border border-neutral-200 bg-white p-6"
        >
          <h2 id="absorbed-heading" className="text-lg font-bold">
            Superseded records pointing here
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Earlier duplicate records resolved into this one. Each remains preserved and readable.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {review.absorbed.map((link) => (
              <li key={link.personId}>
                <Link
                  href={`/staff/registry/${link.personId}`}
                  className="text-brand-700 underline"
                >
                  {link.fullName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-neutral-500">Date of birth</dt>
          <dd className="tabular mt-1 text-neutral-900">{person.birthdate ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Residency basis</dt>
          <dd className="mt-1 text-neutral-900">
            {RESIDENCY_BASES[person.residencyBasisKey].label}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Online account</dt>
          <dd className="mt-1 text-neutral-900">
            {person.hasAccount ? 'Linked to an account' : 'No account linked'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Verification</dt>
          <dd className="mt-1 text-neutral-900">
            {person.verificationState ?? 'No application yet'}
          </dd>
        </div>
      </dl>

      {/* Slice 2E: side-by-side comparison for every registry.read holder;
          resolution controls only for registry.resolve_duplicates. A frozen
          (superseded) record gets no candidates — history is not a merge
          target. */}
      {!person.superseded ? (
        <DuplicateResolutionPanel
          barangayId={active.barangayId}
          person={person}
          candidates={review.candidates}
          canResolve={canResolve}
        />
      ) : null}

      <p className="text-sm text-neutral-500">
        Reviewing evidence documents arrives in the next update.
      </p>

      {/* The counter entry point for Slice 3C. Offered from the registry
          record rather than from a picker of its own, so the person is always
          one that registry search already vetted for tenant and duplicates. */}
      {canFileRequest ? (
        <div>
          <Link
            href={`/staff/requests/new?person=${person.personId}`}
            className="bg-brand-700 hover:bg-brand-800 inline-flex min-h-11 items-center rounded-md px-4 py-2 font-medium text-white"
          >
            File a document request
          </Link>
        </div>
      ) : null}

      <p className="text-sm text-neutral-500">
        <Link href="/staff/registry" className="text-brand-700 underline">
          Back to the registry
        </Link>
      </p>
    </div>
  )
}
