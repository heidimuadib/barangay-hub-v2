'use client'

import { useActionState } from 'react'

import type { Result } from '@/lib/errors'

import { inviteMemberAction } from '../actions/manage-membership'

export function InviteForm({ barangayId }: { barangayId: string }) {
  const [state, formAction, isPending] = useActionState<Result<{ invited: true }> | null, FormData>(
    inviteMemberAction,
    null,
  )

  const errorMessage = state && !state.ok ? state.error.message : null
  const fieldError = state && !state.ok ? (state.error.fieldErrors?.email?.[0] ?? null) : null
  const succeeded = state?.ok === true

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-lg border border-neutral-200 bg-white p-4"
    >
      <input type="hidden" name="barangayId" value={barangayId} />

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <label htmlFor="invite-email" className="text-sm font-medium text-neutral-900">
            Invite an existing account by email
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            aria-describedby="invite-help"
            className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {isPending ? 'Inviting…' : 'Invite'}
        </button>
      </div>

      <p id="invite-help" className="mt-2 text-sm text-neutral-500">
        The person must already have an account. The invitation starts as an inactive membership you
        can activate afterwards.
      </p>

      {succeeded ? (
        <p role="status" className="text-success-700 mt-2 text-sm">
          Invitation created. The member appears below with the invited status.
        </p>
      ) : null}
      {errorMessage === null ? null : (
        <p role="alert" className="text-danger-700 mt-2 text-sm">
          {fieldError ?? errorMessage}
        </p>
      )}
    </form>
  )
}
