import type { VerificationState } from '../types/registry'

/**
 * Resident-facing verification status. Copy is deliberately plain and never
 * blames the resident for a pending review.
 */
const STATUS_COPY: Record<VerificationState, { label: string; tone: string; explanation: string }> =
  {
    draft: {
      label: 'Not submitted yet',
      tone: 'bg-neutral-100 text-neutral-700',
      explanation: 'Add your documents, then submit your registration for review.',
    },
    submitted: {
      label: 'Waiting for review',
      tone: 'bg-info-100 text-info-700',
      explanation: 'Your barangay has your registration. No action is needed from you right now.',
    },
    in_review: {
      label: 'Being reviewed',
      tone: 'bg-info-100 text-info-700',
      explanation: 'A barangay reviewer is checking your details.',
    },
    info_requested: {
      label: 'More information needed',
      tone: 'bg-warning-100 text-warning-700',
      explanation: 'The barangay needs something else before they can finish your registration.',
    },
    resubmitted: {
      label: 'Waiting for review',
      tone: 'bg-info-100 text-info-700',
      explanation: 'Your updated registration is back with the barangay.',
    },
    approved: {
      label: 'Verified resident',
      tone: 'bg-success-100 text-success-700',
      explanation: 'Your barangay confirmed your registration.',
    },
    rejected: {
      label: 'Not approved',
      tone: 'bg-danger-100 text-danger-700',
      explanation:
        'Your registration was not approved. Contact the barangay office if you think this is a mistake.',
    },
  }

export function VerificationStatusBadge({ state }: { state: VerificationState }) {
  const copy = STATUS_COPY[state]
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${copy.tone}`}>
      {copy.label}
    </span>
  )
}

export function VerificationStatusPanel({
  state,
  barangayName,
  infoRequestNote,
  decisionReason,
}: {
  state: VerificationState
  barangayName: string
  infoRequestNote?: string | null
  decisionReason?: string | null
}) {
  const copy = STATUS_COPY[state]

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Registration with {barangayName}</h2>
        <VerificationStatusBadge state={state} />
      </div>
      <p className="mt-3 text-neutral-700">{copy.explanation}</p>

      {state === 'info_requested' && infoRequestNote ? (
        <div className="border-warning-100 mt-4 rounded-md border bg-white p-4">
          <h3 className="text-sm font-medium text-neutral-900">What the barangay asked for</h3>
          <p className="mt-1 text-neutral-700">{infoRequestNote}</p>
        </div>
      ) : null}

      {state === 'rejected' && decisionReason ? (
        <div className="border-danger-100 mt-4 rounded-md border bg-white p-4">
          <h3 className="text-sm font-medium text-neutral-900">Reason given</h3>
          <p className="mt-1 text-neutral-700">{decisionReason}</p>
        </div>
      ) : null}
    </div>
  )
}
