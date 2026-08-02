'use client'

import { useActionState, useId, useState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'

import {
  approveApplicationAction,
  rejectApplicationAction,
  requestInformationAction,
  startReviewAction,
  type VerificationActionResult,
} from '../actions/verification'
import type { ReviewActionKey } from '../types/registry'

/**
 * Reviewer decision controls (Slice 2D).
 *
 * `actions` is computed on the SERVER from the same transition map the
 * database enforces, filtered by the capabilities the caller actually holds —
 * an unavailable action is not rendered at all. That is convenience: every
 * action re-authorizes in the Server Action guard and again inside the
 * definer function, so these buttons are never the boundary. (It arrives as a
 * prop rather than being derived here because a feature component may not
 * import a feature rule — Phase 6 §16.1.)
 *
 * Terminal decisions (approve / reject) open an explicit confirmation panel
 * before anything is submitted; Start review and Request information act on
 * non-terminal states and submit directly. Only one panel is open at a time,
 * everything is a native button/form (keyboard-operable as-is), and state is
 * announced through role="status" / role="alert" — never colour alone.
 */
export function ReviewActions({
  barangayId,
  applicationId,
  actions,
  terminal,
  holdsAnyReviewCapability,
}: {
  barangayId: string
  applicationId: string
  actions: readonly ReviewActionKey[]
  terminal: boolean
  holdsAnyReviewCapability: boolean
}) {
  const [openPanel, setOpenPanel] = useState<'request_information' | 'approve' | 'reject' | null>(
    null,
  )

  const [startState, startAction, startPending] = useActionState<
    VerificationActionResult | null,
    FormData
  >(startReviewAction, null)
  const [infoState, infoAction, infoPending] = useActionState<
    VerificationActionResult | null,
    FormData
  >(requestInformationAction, null)
  const [approveState, approveAction, approvePending] = useActionState<
    VerificationActionResult | null,
    FormData
  >(approveApplicationAction, null)
  const [rejectState, rejectAction, rejectPending] = useActionState<
    VerificationActionResult | null,
    FormData
  >(rejectApplicationAction, null)

  useRefreshOnSuccess([startState, infoState, approveState, rejectState])

  const noteId = useId()
  const reasonId = useId()

  if (actions.length === 0) {
    return (
      <section
        aria-labelledby="review-actions-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="review-actions-heading" className="text-lg font-bold">
          Actions
        </h2>
        <p role="status" className="mt-2 text-neutral-700">
          {terminal
            ? 'This decision is final. Re-verifying this person requires a new application.'
            : holdsAnyReviewCapability
              ? 'No action is available in the current state.'
              : 'Your role can follow this application but not act on it.'}
        </p>
      </section>
    )
  }

  const errorOf = (result: VerificationActionResult | null, field?: string) => {
    if (!result || result.ok) return null
    if (field) return result.error.fieldErrors?.[field]?.[0] ?? null
    return result.error.message
  }

  return (
    <section
      aria-labelledby="review-actions-heading"
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6"
    >
      <h2 id="review-actions-heading" className="text-lg font-bold">
        Actions
      </h2>

      <div className="flex flex-wrap gap-3">
        {actions.includes('start_review') ? (
          <form action={startAction}>
            <input type="hidden" name="barangayId" value={barangayId} />
            <input type="hidden" name="applicationId" value={applicationId} />
            <button
              type="submit"
              disabled={startPending}
              className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {startPending ? 'Starting…' : 'Start review'}
            </button>
          </form>
        ) : null}

        {actions.includes('request_information') ? (
          <button
            type="button"
            aria-expanded={openPanel === 'request_information'}
            onClick={() =>
              setOpenPanel(openPanel === 'request_information' ? null : 'request_information')
            }
            className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
          >
            Request more information
          </button>
        ) : null}

        {actions.includes('approve') ? (
          <button
            type="button"
            aria-expanded={openPanel === 'approve'}
            onClick={() => setOpenPanel(openPanel === 'approve' ? null : 'approve')}
            className="border-success-700 text-success-700 min-h-11 rounded-md border bg-white px-4 py-2 font-medium hover:bg-neutral-100"
          >
            Approve…
          </button>
        ) : null}

        {actions.includes('reject') ? (
          <button
            type="button"
            aria-expanded={openPanel === 'reject'}
            onClick={() => setOpenPanel(openPanel === 'reject' ? null : 'reject')}
            className="border-danger-700 text-danger-700 min-h-11 rounded-md border bg-white px-4 py-2 font-medium hover:bg-neutral-100"
          >
            Reject…
          </button>
        ) : null}
      </div>

      {errorOf(startState) ? (
        <p role="alert" className="text-danger-700 text-sm">
          {errorOf(startState)}
        </p>
      ) : null}

      {openPanel === 'request_information' ? (
        <form
          action={infoAction}
          className="border-warning-100 flex flex-col gap-3 rounded-md border p-4"
        >
          <input type="hidden" name="barangayId" value={barangayId} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="flex flex-col gap-1">
            <label htmlFor={noteId} className="text-sm font-medium text-neutral-900">
              What does the resident need to provide?
            </label>
            <textarea
              id={noteId}
              name="note"
              required
              rows={3}
              maxLength={1000}
              aria-describedby={`${noteId}-hint`}
              {...(errorOf(infoState, 'note') ? { 'aria-invalid': true } : {})}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2"
            />
            <p id={`${noteId}-hint`} className="text-sm text-neutral-500">
              The resident sees this message exactly as written — plain words, no shorthand.
            </p>
            {errorOf(infoState, 'note') ? (
              <p role="alert" className="text-danger-700 text-sm">
                {errorOf(infoState, 'note')}
              </p>
            ) : null}
            {errorOf(infoState) && !errorOf(infoState, 'note') ? (
              <p role="alert" className="text-danger-700 text-sm">
                {errorOf(infoState)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={infoPending}
              className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {infoPending ? 'Sending…' : 'Send request'}
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {openPanel === 'approve' ? (
        <form
          action={approveAction}
          className="border-success-100 flex flex-col gap-3 rounded-md border p-4"
        >
          <input type="hidden" name="barangayId" value={barangayId} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <h3 className="font-medium text-neutral-900">Confirm approval</h3>
          <p className="text-neutral-700">
            This marks the person as a verified resident. If an account is linked, its barangay
            membership becomes active in the same step. Approval is final — it cannot be undone,
            only superseded by a new application.
          </p>
          {errorOf(approveState) ? (
            <p role="alert" className="text-danger-700 text-sm">
              {errorOf(approveState)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={approvePending}
              className="bg-success-700 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {approvePending ? 'Approving…' : 'Confirm approval'}
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {openPanel === 'reject' ? (
        <form
          action={rejectAction}
          className="border-danger-100 flex flex-col gap-3 rounded-md border p-4"
        >
          <input type="hidden" name="barangayId" value={barangayId} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <h3 className="font-medium text-neutral-900">Confirm rejection</h3>
          <div className="flex flex-col gap-1">
            <label htmlFor={reasonId} className="text-sm font-medium text-neutral-900">
              Reason (required)
            </label>
            <textarea
              id={reasonId}
              name="reason"
              required
              rows={3}
              maxLength={1000}
              aria-describedby={`${reasonId}-hint`}
              {...(errorOf(rejectState, 'reason') ? { 'aria-invalid': true } : {})}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2"
            />
            <p id={`${reasonId}-hint`} className="text-sm text-neutral-500">
              Shown to the resident word for word, and kept on the permanent record. Rejection is
              final — a new application is required afterwards.
            </p>
            {errorOf(rejectState, 'reason') ? (
              <p role="alert" className="text-danger-700 text-sm">
                {errorOf(rejectState, 'reason')}
              </p>
            ) : null}
            {errorOf(rejectState) && !errorOf(rejectState, 'reason') ? (
              <p role="alert" className="text-danger-700 text-sm">
                {errorOf(rejectState)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={rejectPending}
              className="bg-danger-700 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {rejectPending ? 'Rejecting…' : 'Confirm rejection'}
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
