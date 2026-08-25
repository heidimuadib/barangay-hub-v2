'use client'

import { useActionState } from 'react'

import { Alert, Button, Card, CardBody, CardHeader } from '@/components/ui'
import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'

import { resubmitApplicationAction, type VerificationActionResult } from '../actions/verification'

/**
 * Resident resubmission (Slice 2D): the one action a resident can take while
 * their application is in `info_requested`.
 *
 * The committed domain rule is deliberate and small: resubmission flips the
 * state back to the review queue and enqueues the notification intent — it
 * carries no free-text note (no such column exists), and document updates
 * happen while the application sits in `info_requested` (the upload surface
 * itself arrives with 2F; until then staff can attach documents at the
 * counter). Ownership is enforced inside the database function.
 */
export function ResubmissionForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, isPending] = useActionState<VerificationActionResult | null, FormData>(
    resubmitApplicationAction,
    null,
  )

  useRefreshOnSuccess([state])

  const error = state && !state.ok ? state.error.message : null
  const resubmitted = state?.ok === true

  if (resubmitted) {
    return (
      <Alert tone="success" title="Sent back for review">
        Your registration is back with the barangay. No further action is needed from you right now.
      </Alert>
    )
  }

  return (
    <form action={formAction} aria-labelledby="resubmit-heading">
      <Card>
        <CardHeader id="resubmit-heading" as="h2" title="Ready to resubmit?" />
        <CardBody>
          <input type="hidden" name="applicationId" value={applicationId} />
          <p className="text-neutral-700">
            Once you have uploaded what the barangay asked for, send your registration back for
            review. If it involves physical documents, you can also bring them to the barangay
            office.
          </p>
          {error ? (
            <div className="mt-3">
              <Alert tone="danger" live="alert">
                {error}
              </Alert>
            </div>
          ) : null}
          <div className="mt-4">
            <Button type="submit" variant="primary" size="md" disabled={isPending}>
              {isPending ? 'Sending…' : 'Resubmit for review'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  )
}
