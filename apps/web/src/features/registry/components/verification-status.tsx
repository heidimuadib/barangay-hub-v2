import { Alert, Badge, type BadgeTone, Card, CardBody, CardHeader } from '@/components/ui'

import type { VerificationState } from '../types/registry'

/**
 * Resident-facing verification status. Copy is deliberately plain and never
 * blames the resident for a pending review.
 */
const STATUS_COPY: Record<
  VerificationState,
  { label: string; tone: BadgeTone; explanation: string }
> = {
  draft: {
    label: 'Not submitted yet',
    tone: 'neutral',
    explanation: 'Add your documents, then submit your registration for review.',
  },
  submitted: {
    label: 'Waiting for review',
    tone: 'info',
    explanation: 'Your barangay has your registration. No action is needed from you right now.',
  },
  in_review: {
    label: 'Being reviewed',
    tone: 'info',
    explanation: 'A barangay reviewer is checking your details.',
  },
  info_requested: {
    label: 'More information needed',
    tone: 'warning',
    explanation: 'The barangay needs something else before they can finish your registration.',
  },
  resubmitted: {
    label: 'Waiting for review',
    tone: 'info',
    explanation: 'Your updated registration is back with the barangay.',
  },
  approved: {
    label: 'Verified resident',
    tone: 'success',
    explanation: 'Your barangay confirmed your registration.',
  },
  rejected: {
    label: 'Not approved',
    tone: 'danger',
    explanation:
      'Your registration was not approved. Contact the barangay office if you think this is a mistake.',
  },
}

export function VerificationStatusBadge({ state }: { state: VerificationState }) {
  const copy = STATUS_COPY[state]
  return <Badge tone={copy.tone}>{copy.label}</Badge>
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
    <Card accent={state === 'approved'}>
      <CardHeader
        as="h2"
        title={`Registration with ${barangayName}`}
        action={<VerificationStatusBadge state={state} />}
      />
      <CardBody>
        <p className="text-neutral-700">{copy.explanation}</p>

        {state === 'info_requested' && infoRequestNote ? (
          <div className="mt-4">
            <Alert tone="warning" title="What the barangay asked for" live="none">
              {infoRequestNote}
            </Alert>
          </div>
        ) : null}

        {state === 'rejected' && decisionReason ? (
          <div className="mt-4">
            <Alert tone="danger" title="Reason given" live="none">
              {decisionReason}
            </Alert>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
