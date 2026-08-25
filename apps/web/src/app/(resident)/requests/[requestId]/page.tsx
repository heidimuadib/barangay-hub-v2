import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { Card, CardBody, CardHeader, DetailList, PageHeader } from '@/components/ui'
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

  const answerItems = detail.answers.map((answer) => ({
    label: answer.label,
    value: answer.value,
  }))

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/requests"
          className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center text-sm font-medium hover:underline"
        >
          &larr; My requests
        </Link>
        <div className="mt-2">
          <PageHeader
            title={detail.documentType.name}
            action={<RequestStateChip state={detail.state} />}
          />
        </div>
      </div>

      <section aria-labelledby="progress-heading">
        <Card>
          <CardHeader id="progress-heading" as="h2" title="Progress" />
          <CardBody>
            <RequestProgress steps={steps} />
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="purpose-heading">
        <Card>
          <CardHeader id="purpose-heading" as="h2" title="Why you need it" />
          <CardBody>
            <p className="text-neutral-800">{detail.purpose}</p>
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="terms-heading">
        <Card>
          <CardHeader id="terms-heading" as="h2" title="Fee and processing" />
          <CardBody>
            <DocumentTerms terms={terms} headingId="terms-heading" />
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="answers-heading">
        <Card>
          <CardHeader id="answers-heading" as="h2" title="Your answers" />
          <CardBody>
            {detail.answers.length === 0 ? (
              <p className="text-neutral-700">You have not answered anything yet.</p>
            ) : (
              <DetailList items={answerItems} />
            )}
          </CardBody>
        </Card>
      </section>

      {detail.documentType.requiresSupportingEvidence || evidence.length > 0 ? (
        <section aria-labelledby="evidence-heading">
          <Card>
            <CardHeader id="evidence-heading" as="h2" title="Supporting documents" />
            <CardBody>
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
            </CardBody>
          </Card>
        </section>
      ) : null}

      {draft ? (
        <>
          <section aria-labelledby="edit-heading" className="space-y-4">
            <h2 id="edit-heading" className="text-lg font-bold text-neutral-900">
              Change your answers
            </h2>
            <AnswerForm
              barangayId={active.barangayId}
              requestId={detail.requestId}
              requirements={detail.requirements}
              initialAnswers={answersByKey}
            />
          </section>

          <section aria-labelledby="submit-heading">
            <Card>
              <CardHeader id="submit-heading" as="h2" title="Send it to the barangay" />
              <CardBody>
                <SubmitRequest
                  barangayId={active.barangayId}
                  requestId={detail.requestId}
                  canSubmit={missing.length === 0 && evidenceReady.satisfied}
                  missingCount={missing.length}
                  evidenceMissing={!evidenceReady.satisfied}
                />
              </CardBody>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  )
}
