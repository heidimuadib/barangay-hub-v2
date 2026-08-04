'use client'

import { useActionState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import {
  markReadyAction,
  startReviewAction,
  type StaffRequestActionData,
} from '../actions/staff-requests'
import type { RequestActionKey } from '../types/documents'

/**
 * The reviewer controls on a staff request detail (Slice 3C).
 *
 * `actions` is computed on the SERVER by `availableRequestActions`, which
 * intersects the transition map the database enforces with the capabilities
 * this caller actually holds. So a control is never rendered for a step the
 * role may not take or the state does not permit — and the database re-checks
 * both anyway.
 *
 * Neither transition takes a reason. They move a request along a queue rather
 * than deciding anything about a person, which is why they differ from Slice
 * 2's rejection — that one requires a reason and shows it to the resident.
 */

const COPY: Record<RequestActionKey, { label: string; pending: string; hint: string }> = {
  start_review: {
    label: 'Start review',
    pending: 'Starting…',
    hint: 'Tells the resident someone has picked their request up.',
  },
  mark_ready: {
    label: 'Mark ready to collect',
    pending: 'Marking…',
    hint: 'Tells the resident their document is ready. Issuing it is a later step.',
  },
}

export function RequestReviewActions({
  barangayId,
  requestId,
  actions,
}: {
  barangayId: string
  requestId: string
  actions: readonly RequestActionKey[]
}) {
  if (actions.length === 0) {
    return (
      <p className="text-neutral-700">There is nothing for you to do on this request right now.</p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {actions.map((action) => (
        <TransitionControl
          key={action}
          action={action}
          barangayId={barangayId}
          requestId={requestId}
        />
      ))}
    </div>
  )
}

function TransitionControl({
  action,
  barangayId,
  requestId,
}: {
  action: RequestActionKey
  barangayId: string
  requestId: string
}) {
  const [state, formAction, isPending] = useActionState<
    Result<StaffRequestActionData> | null,
    FormData
  >(action === 'start_review' ? startReviewAction : markReadyAction, null)

  useRefreshOnSuccess([state])

  const copy = COPY[action]
  const error = state && !state.ok ? state.error.message : null

  return (
    <form action={formAction} className="flex flex-col gap-2">
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
          disabled={isPending}
          className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {isPending ? copy.pending : copy.label}
        </button>
        <p className="mt-2 text-sm text-neutral-500">{copy.hint}</p>
      </div>
    </form>
  )
}
