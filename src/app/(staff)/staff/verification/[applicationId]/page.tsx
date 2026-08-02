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
import {
  EvidenceViewButton,
  QueueStateChip,
  REGISTRY_PERMISSIONS,
  RESIDENCY_BASES,
  ReviewActions,
  availableReviewActions,
  evidenceKindLabel,
  evidenceMimeLabel,
  formatEvidenceSize,
  getApplicationDetail,
  isTerminal,
} from '@/features/registry'

export const metadata: Metadata = {
  title: 'Verification review',
  robots: { index: false, follow: false },
}

/**
 * Review detail (Slice 2D). Gated on `verification.read`; actions are
 * per-capability. The URL carries an opaque application UUID and nothing
 * else; a wrong-tenant id and a nonexistent id are indistinguishable
 * (Phase 4 §13.6) — RLS returns nothing either way and both render the
 * neutral not-found page.
 *
 * Evidence FILE contents are deliberately absent — the signed-read broker is
 * subpart 2F. What appears here is metadata, and only for holders of
 * `verification.evidence.read`.
 */
export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>
}) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, REGISTRY_PERMISSIONS.verificationRead)) {
    redirect('/access-denied')
  }

  const { applicationId } = await params
  const detail = await getApplicationDetail(active.barangayId, applicationId)
  if (!detail) {
    notFound()
  }

  // Availability is decided on the server, from the same transition map the
  // database enforces — the client component only renders what it is handed.
  const capabilities = {
    canReview: can(context, active.barangayId, REGISTRY_PERMISSIONS.verificationReview),
    canRequestInformation: can(context, active.barangayId, REGISTRY_PERMISSIONS.requestInformation),
    canApprove: can(context, active.barangayId, REGISTRY_PERMISSIONS.approve),
    canReject: can(context, active.barangayId, REGISTRY_PERMISSIONS.reject),
  }
  const actions = availableReviewActions(detail.state, capabilities)
  const holdsAnyReviewCapability = Object.values(capabilities).some(Boolean)

  const { person } = detail

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold">{person.fullName}</h1>
          <QueueStateChip state={detail.state} />
        </div>
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
          The person on this application was superseded during duplicate resolution.
        </p>
      ) : null}

      <section
        aria-labelledby="applicant-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="applicant-heading" className="text-lg font-bold">
          Applicant
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-neutral-500">Date of birth</dt>
            <dd className="tabular mt-1 text-neutral-900">{person.birthdate ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Residency basis</dt>
            <dd className="mt-1 text-neutral-900">
              {RESIDENCY_BASES[person.residencyBasisKey].label}
              {person.residencyExplanation ? (
                <span className="block text-sm text-neutral-700">
                  {person.residencyExplanation}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Contact number</dt>
            <dd className="tabular mt-1 text-neutral-900">
              {person.contactPhone ?? 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Address</dt>
            <dd className="mt-1 text-neutral-900">{person.addressLine ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Online account</dt>
            <dd className="mt-1 text-neutral-900">
              {person.hasAccount ? 'Linked to an account' : 'No account linked'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Registry record</dt>
            <dd className="mt-1">
              <Link
                href={`/staff/registry/${person.personId}`}
                className="text-brand-700 underline"
              >
                Open in the registry
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="timeline-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="timeline-heading" className="text-lg font-bold">
          Application timeline
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-neutral-500">Started</dt>
            <dd className="tabular mt-1 text-neutral-900">{detail.createdAt.slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Submitted</dt>
            <dd className="tabular mt-1 text-neutral-900">
              {detail.submittedAt ? detail.submittedAt.slice(0, 10) : 'Not yet'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Decided</dt>
            <dd className="tabular mt-1 text-neutral-900">
              {detail.decidedAt ? detail.decidedAt.slice(0, 10) : 'Not yet'}
            </dd>
          </div>
        </dl>

        {detail.infoRequestNote ? (
          <div className="border-warning-100 mt-4 rounded-md border p-4">
            <h3 className="text-sm font-medium text-neutral-900">Information requested</h3>
            <p className="mt-1 text-neutral-700">{detail.infoRequestNote}</p>
          </div>
        ) : null}

        {detail.decisionReason ? (
          <div className="border-danger-100 mt-4 rounded-md border p-4">
            <h3 className="text-sm font-medium text-neutral-900">Decision reason</h3>
            <p className="mt-1 text-neutral-700">{detail.decisionReason}</p>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="evidence-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="evidence-heading" className="text-lg font-bold">
          Documents
        </h2>
        {detail.evidence === null ? (
          <p className="mt-2 text-neutral-700">
            Document details require the evidence capability, which your role does not hold. The
            review states above already reflect whether the required documents are attached.
          </p>
        ) : detail.evidence.length === 0 ? (
          <p className="mt-2 text-neutral-700">No documents are attached yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
            {detail.evidence.map((item) => (
              <li
                key={item.evidenceId}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-neutral-900">
                    {evidenceKindLabel(item.kind)}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {evidenceMimeLabel(item.mimeType)}
                    {item.uploadedAt !== null && item.sizeBytes !== null
                      ? ` · ${formatEvidenceSize(item.sizeBytes)}`
                      : ''}{' '}
                    ·{' '}
                    {item.uploadedAt
                      ? `added ${item.uploadedAt.slice(0, 10)}`
                      : 'upload not finished'}
                  </span>
                </div>
                {/* Slice 2F: a signed URL is requested only when the reviewer
                    asks, and only for finalized objects. Nothing is embedded
                    or prefetched, and the path is never rendered. */}
                {item.uploadedAt !== null ? (
                  <EvidenceViewButton
                    barangayId={active.barangayId}
                    evidenceId={item.evidenceId}
                    label={evidenceKindLabel(item.kind).toLowerCase()}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-neutral-500">
          Viewing the document files themselves arrives in a later update, behind the same
          capability.
        </p>
      </section>

      <section
        aria-labelledby="duplicates-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="duplicates-heading" className="text-lg font-bold">
          Possible duplicate records
        </h2>
        {detail.duplicates.length === 0 ? (
          <p className="mt-2 text-neutral-700">
            No similar person record was found in this barangay.
          </p>
        ) : (
          <>
            <p className="mt-2 text-neutral-700">
              Similar names are a signal, not proof of identity. Compare carefully before deciding.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {detail.duplicates.map((candidate) => (
                <li
                  key={candidate.personId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-4 py-3"
                >
                  <Link
                    href={`/staff/registry/${candidate.personId}`}
                    className="text-brand-700 font-medium underline"
                  >
                    {candidate.firstName} {candidate.lastName}
                  </Link>
                  <span className="text-sm text-neutral-500">
                    {candidate.sameBirthdate ? 'same birthdate · ' : ''}
                    {candidate.hasAccount ? 'has an account' : 'no account'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3 text-sm text-neutral-500">
          {can(context, active.barangayId, REGISTRY_PERMISSIONS.resolveDuplicates) ? (
            <>
              To resolve a duplicate (supersede-and-link),{' '}
              <Link
                href={`/staff/registry/${person.personId}`}
                className="text-brand-700 underline"
              >
                open the applicant&rsquo;s registry record
              </Link>
              . Nothing on this page merges records.
            </>
          ) : (
            <>
              Resolving duplicates needs its own capability and happens on the registry record.
              Nothing on this page merges records.
            </>
          )}
        </p>
      </section>

      <ReviewActions
        barangayId={active.barangayId}
        applicationId={detail.applicationId}
        actions={actions}
        terminal={isTerminal(detail.state)}
        holdsAnyReviewCapability={holdsAnyReviewCapability}
      />

      <p className="text-sm text-neutral-500">
        <Link href="/staff/verification" className="text-brand-700 underline">
          Back to the queue
        </Link>
      </p>
    </div>
  )
}
