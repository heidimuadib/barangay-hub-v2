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
  DOCUMENT_PERMISSIONS,
  DocumentTerms,
  RequestEvidenceViewer,
  RequestProgress,
  RequestQueueChip,
  RequestReviewActions,
  availableRequestActions,
  canReadRequestEvidence,
  getStaffRequestDetail,
  listRequestEvidence,
  presentTerms,
  requestTimeline,
  reviewerCapabilities,
} from '@/features/documents'

export const metadata: Metadata = {
  title: 'Document request',
  robots: { index: false, follow: false },
}

/**
 * One request as staff see it (Slice 3C).
 *
 * Carries what the resident view deliberately omits — who asked, which door
 * the request came through, and why staff filed it — because that is the
 * accountability record counter work runs on.
 *
 * The controls are computed on the SERVER from the transition map the database
 * enforces, intersected with the capabilities this caller holds, so the page
 * cannot offer a step the role or the state forbids.
 *
 * The URL is an opaque request UUID and nothing more (P6-C-E).
 */
export default async function StaffRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, DOCUMENT_PERMISSIONS.requestsRead)) {
    redirect('/access-denied')
  }

  const { requestId } = await params
  const detail = await getStaffRequestDetail(active.barangayId, requestId)
  // A request in another barangay is indistinguishable from one that does not
  // exist (Phase 4 §13.6) — RLS returns nothing either way.
  if (!detail) {
    notFound()
  }

  const actions = availableRequestActions(
    detail.state,
    reviewerCapabilities(context, active.barangayId),
  )
  // RLS would return an empty list to a caller without the capability, and
  // "no documents" must never be conflated with "not yours to see" — so the
  // capability is checked explicitly and the page renders the difference.
  const mayReadEvidence = canReadRequestEvidence(context, active.barangayId)
  const evidence = mayReadEvidence ? await listRequestEvidence(detail.requestId) : null

  const terms = presentTerms(detail.documentType.terms)
  const steps = requestTimeline(detail.state, {
    createdAt: detail.createdAt,
    submittedAt: detail.submittedAt,
    reviewStartedAt: detail.reviewStartedAt,
    readyAt: detail.readyAt,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/staff/requests"
          className="text-brand-700 inline-flex min-h-11 items-center hover:underline"
        >
          ← Document requests
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{detail.documentType.name}</h1>
          <RequestQueueChip state={detail.state} />
        </div>
      </div>

      <section
        aria-labelledby="requester-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="requester-heading" className="text-lg font-bold">
          Requester
        </h2>
        {detail.requester === null ? (
          <p className="mt-2 text-neutral-700">
            Your role can see this request but not the resident’s registry record.
          </p>
        ) : (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-neutral-500">Name</dt>
              <dd className="text-neutral-900">
                <Link
                  href={`/staff/registry/${detail.requester.personId}`}
                  className="text-brand-700 underline"
                >
                  {detail.requester.fullName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Online account</dt>
              <dd className="text-neutral-900">
                {detail.requester.hasAccount ? 'Linked' : 'None — walk-in resident'}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section
        aria-labelledby="provenance-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="provenance-heading" className="text-lg font-bold">
          How this request was filed
        </h2>
        <dl className="mt-3 flex flex-col gap-3">
          <div>
            <dt className="text-sm font-medium text-neutral-500">Channel</dt>
            <dd className="text-neutral-900">
              {detail.sourceChannel === 'self'
                ? 'Filed online by the resident'
                : 'Filed at the counter by staff'}
            </dd>
          </div>
          {detail.creationReason === null ? null : (
            <div>
              <dt className="text-sm font-medium text-neutral-500">Reason recorded</dt>
              <dd className="text-neutral-900">{detail.creationReason}</dd>
            </div>
          )}
        </dl>
      </section>

      <section
        aria-labelledby="purpose-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="purpose-heading" className="text-lg font-bold">
          What the resident needs it for
        </h2>
        <p className="mt-2 text-neutral-700">{detail.purpose}</p>
      </section>

      <section
        aria-labelledby="answers-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="answers-heading" className="text-lg font-bold">
          Answers
        </h2>
        {detail.answers.length === 0 ? (
          <p className="mt-2 text-neutral-700">This request has no answers recorded.</p>
        ) : (
          <dl className="mt-3 flex flex-col gap-3">
            {detail.answers.map((answer) => (
              <div key={answer.requirementId} className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-neutral-500">{answer.label}</dt>
                <dd className="text-neutral-900">{answer.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section
        aria-labelledby="evidence-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="evidence-heading" className="text-lg font-bold">
          Supporting documents
        </h2>
        <div className="mt-3">
          <RequestEvidenceViewer barangayId={active.barangayId} items={evidence} />
        </div>
      </section>

      <section
        aria-labelledby="terms-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="terms-heading" className="text-lg font-bold">
          Fee and processing
        </h2>
        <div className="mt-3">
          <DocumentTerms terms={terms} headingId="terms-heading" />
        </div>
      </section>

      <section
        aria-labelledby="progress-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="progress-heading" className="text-lg font-bold">
          Progress
        </h2>
        <div className="mt-3">
          <RequestProgress steps={steps} />
        </div>
      </section>

      <section
        aria-labelledby="actions-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="actions-heading" className="text-lg font-bold">
          Move this request along
        </h2>
        <div className="mt-3">
          <RequestReviewActions
            barangayId={active.barangayId}
            requestId={detail.requestId}
            actions={actions}
          />
        </div>
      </section>
    </div>
  )
}
