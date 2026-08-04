import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import {
  AnswerForm,
  DocumentTerms,
  RequestEvidenceManager,
  RequestProgress,
  RequestStateChip,
  SubmitRequest,
  getOwnRequestDetail,
  isEditable,
  listRequestEvidence,
  missingRequirementKeys,
  presentTerms,
  requestEvidenceReadiness,
  requestTimeline,
} from '@/features/documents'

export const metadata: Metadata = {
  title: 'My request',
  robots: { index: false, follow: false },
}

/**
 * One of the resident's own requests (Slice 3B).
 *
 * Shows only what the REQUESTER needs: what they asked for, what they
 * answered, where it has got to, and the terms — still placeholder-marked
 * (B-08). It deliberately carries none of the staff-side record: no
 * `created_by`, no `creation_reason`, no `source_channel`, no reviewer
 * identity. Those belong to the 3C staff surface, behind `requests.read`.
 *
 * The URL is an opaque request UUID and nothing more (P6-C-E). Another
 * resident's id renders the same not-found as one that never existed.
 */
export default async function RequestDetailPage({
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
  if (!active) {
    redirect('/access-denied')
  }

  const { requestId } = await params
  const detail = await getOwnRequestDetail(active.barangayId, requestId)
  if (!detail) {
    notFound()
  }

  const terms = presentTerms(detail.documentType.terms)
  const steps = requestTimeline(detail.state, {
    createdAt: detail.createdAt,
    submittedAt: detail.submittedAt,
    reviewStartedAt: detail.reviewStartedAt,
    readyAt: detail.readyAt,
  })

  // Keyed by requirement key, which is what the completeness rule reads — the
  // same rule `submit_request` applies inside the transaction.
  const answersByKey = Object.fromEntries(
    detail.answers.map((answer) => [answer.key, answer.value]),
  )
  const missing = missingRequirementKeys(detail.requirements, answersByKey)
  const draft = isEditable(detail.state)

  // Evidence is only relevant where the type asks for it — but it is listed
  // whenever any exists, so a resident can see what they attached to a request
  // whose type stopped requiring it.
  const evidence = await listRequestEvidence(detail.requestId)
  const evidenceReady = requestEvidenceReadiness(
    evidence,
    detail.documentType.requiresSupportingEvidence,
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/requests"
          className="text-brand-700 inline-flex min-h-11 items-center hover:underline"
        >
          ← My requests
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{detail.documentType.name}</h1>
          <RequestStateChip state={detail.state} />
        </div>
      </div>

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
        aria-labelledby="purpose-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="purpose-heading" className="text-lg font-bold">
          Why you need it
        </h2>
        <p className="mt-2 text-neutral-700">{detail.purpose}</p>
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
        aria-labelledby="answers-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="answers-heading" className="text-lg font-bold">
          Your answers
        </h2>
        {detail.answers.length === 0 ? (
          <p className="mt-2 text-neutral-700">You have not answered anything yet.</p>
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

      {detail.documentType.requiresSupportingEvidence || evidence.length > 0 ? (
        <section
          aria-labelledby="evidence-heading"
          className="rounded-lg border border-neutral-200 bg-white p-6"
        >
          <h2 id="evidence-heading" className="text-lg font-bold">
            Supporting documents
          </h2>
          <div className="mt-3">
            {draft ? (
              <RequestEvidenceManager
                requestId={detail.requestId}
                items={evidence}
                required={detail.documentType.requiresSupportingEvidence}
              />
            ) : evidence.length === 0 ? (
              <p className="text-neutral-700">Nothing was attached.</p>
            ) : (
              <p className="text-neutral-700">
                {evidenceReady.finalizedCount} document
                {evidenceReady.finalizedCount === 1 ? '' : 's'} attached. They can no longer be
                changed.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {draft ? (
        <>
          <section aria-labelledby="edit-heading" className="flex flex-col gap-3">
            <h2 id="edit-heading" className="text-lg font-bold">
              Change your answers
            </h2>
            <AnswerForm
              barangayId={active.barangayId}
              requestId={detail.requestId}
              requirements={detail.requirements}
              initialAnswers={answersByKey}
            />
          </section>

          <section
            aria-labelledby="submit-heading"
            className="rounded-lg border border-neutral-200 bg-white p-6"
          >
            <h2 id="submit-heading" className="text-lg font-bold">
              Send it to the barangay
            </h2>
            <div className="mt-3">
              <SubmitRequest
                barangayId={active.barangayId}
                requestId={detail.requestId}
                canSubmit={missing.length === 0 && evidenceReady.satisfied}
                missingCount={missing.length}
                evidenceMissing={!evidenceReady.satisfied}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
