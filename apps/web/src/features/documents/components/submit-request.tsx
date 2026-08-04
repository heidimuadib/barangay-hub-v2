'use client'

import { useActionState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import { submitRequestAction, type RequestActionData } from '../actions/requests'

/**
 * draft → submitted (Slice 3B).
 *
 * `canSubmit` is evaluated on the SERVER from the same completeness rule
 * `submit_request` enforces, so the control is never offered for a request the
 * database would refuse. When it IS disabled the reason is stated, because a
 * dead button with no explanation is the most common way a resident gives up.
 *
 * Submitting twice is refused by the database with ILLEGAL_TRANSITION and
 * surfaces here as a plain conflict message — the second click cannot create a
 * second submission, and does not silently appear to have worked.
 */
export function SubmitRequest({
  barangayId,
  requestId,
  canSubmit,
  missingCount,
  evidenceMissing = false,
}: {
  barangayId: string
  requestId: string
  canSubmit: boolean
  missingCount: number
  /** Slice 3D: the type asks for a supporting document and none is finalized. */
  evidenceMissing?: boolean
}) {
  const [state, formAction, isPending] = useActionState<Result<RequestActionData> | null, FormData>(
    submitRequestAction,
    null,
  )

  useRefreshOnSuccess([state])

  const error = state && !state.ok ? state.error.message : null

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="barangayId" value={barangayId} />
      <input type="hidden" name="requestId" value={requestId} />

      {error === null ? null : (
        <p
          role="alert"
          className="border-danger-100 text-danger-700 rounded-md border bg-white px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending || !canSubmit}
          className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {isPending ? 'Sending…' : 'Submit to the barangay'}
        </button>
        {canSubmit ? (
          <p className="mt-2 text-sm text-neutral-500">
            Once you submit, your answers can no longer be changed.
          </p>
        ) : (
          // Both reasons are stated, because fixing one and still being
          // blocked by the other is exactly how people give up.
          <p className="mt-2 text-sm text-neutral-700">
            {missingCount > 0
              ? `Answer ${missingCount} more required question${missingCount === 1 ? '' : 's'}`
              : ''}
            {missingCount > 0 && evidenceMissing ? ', and attach' : ''}
            {missingCount === 0 && evidenceMissing ? 'Attach' : ''}
            {evidenceMissing ? ' the supporting document this request needs' : ''}
            {' before submitting.'}
          </p>
        )}
      </div>
    </form>
  )
}
