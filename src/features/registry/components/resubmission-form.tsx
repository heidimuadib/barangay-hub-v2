'use client'

import { useActionState } from 'react'

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
      <div role="status" className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-bold">Sent back for review</h2>
        <p className="mt-2 text-neutral-700">
          Your registration is back with the barangay. No further action is needed from you right
          now.
        </p>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      aria-labelledby="resubmit-heading"
      className="rounded-lg border border-neutral-200 bg-white p-6"
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <h2 id="resubmit-heading" className="text-lg font-bold">
        Ready to resubmit?
      </h2>
      <p className="mt-2 text-neutral-700">
        Once you have what the barangay asked for, send your registration back for review. If it
        involves documents, you can bring them to the barangay office — staff will attach them to
        your registration with you.
      </p>
      {error ? (
        <p role="alert" className="text-danger-700 mt-3 text-sm">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-700 hover:bg-brand-800 mt-4 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'Sending…' : 'Resubmit for review'}
      </button>
    </form>
  )
}
