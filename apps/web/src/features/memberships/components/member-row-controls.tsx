'use client'

import { useActionState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import {
  assignRoleAction,
  removeRoleAction,
  updateMembershipStatusAction,
} from '../actions/manage-membership'
import type { BarangayRoleOption, RosterMember } from '../types/roster'

/**
 * Mutation controls for one roster row. Rendered ONLY when the server already
 * verified the caller may manage members — and even then, every submit is
 * re-authorized by the action and by RLS. Hiding a control is convenience;
 * it is never the enforcement (Phase 3 ADR-01).
 */
export function MemberRowControls({
  barangayId,
  member,
  roleOptions,
  canManage,
  canAssign,
}: {
  barangayId: string
  member: RosterMember
  roleOptions: readonly BarangayRoleOption[]
  canManage: boolean
  canAssign: boolean
}) {
  const [statusState, statusAction, statusPending] = useActionState<Result<null> | null, FormData>(
    updateMembershipStatusAction,
    null,
  )
  const [assignState, assignAction, assignPending] = useActionState<Result<null> | null, FormData>(
    assignRoleAction,
    null,
  )
  const [removeState, removeAction, removePending] = useActionState<Result<null> | null, FormData>(
    removeRoleAction,
    null,
  )

  // The table is rendered by a Server Component, so a committed mutation is
  // only visible once the route is refetched (R-1-06).
  useRefreshOnSuccess([statusState, assignState, removeState])

  const errorMessage =
    [statusState, assignState, removeState]
      .map((state) => (state && !state.ok ? state.error.message : null))
      .find((message) => message !== null) ?? null

  const assignable = roleOptions.filter((option) => !member.roles.includes(option.key))
  const controlId = (suffix: string) => `member-${member.membershipId}-${suffix}`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <form action={statusAction} className="flex items-center gap-1">
            <input type="hidden" name="barangayId" value={barangayId} />
            <input type="hidden" name="membershipId" value={member.membershipId} />
            <label htmlFor={controlId('status')} className="sr-only-focusable">
              Change status for {member.displayName}
            </label>
            <select
              id={controlId('status')}
              name="status"
              defaultValue={member.status}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-2 text-sm"
            >
              <option value="invited">invited</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
            <button
              type="submit"
              disabled={statusPending}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60"
            >
              {statusPending ? 'Saving…' : 'Set status'}
            </button>
          </form>
        ) : null}

        {canAssign && assignable.length > 0 ? (
          <form action={assignAction} className="flex items-center gap-1">
            <input type="hidden" name="barangayId" value={barangayId} />
            <input type="hidden" name="membershipId" value={member.membershipId} />
            <label htmlFor={controlId('role')} className="sr-only-focusable">
              Add a role for {member.displayName}
            </label>
            <select
              id={controlId('role')}
              name="roleKey"
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-2 text-sm"
            >
              {assignable.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={assignPending}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60"
            >
              {assignPending ? 'Adding…' : 'Add role'}
            </button>
          </form>
        ) : null}

        {canAssign
          ? member.roles.map((roleKey) => (
              <form key={roleKey} action={removeAction}>
                <input type="hidden" name="barangayId" value={barangayId} />
                <input type="hidden" name="membershipId" value={member.membershipId} />
                <input type="hidden" name="roleKey" value={roleKey} />
                <button
                  type="submit"
                  disabled={removePending}
                  className="text-danger-700 min-h-11 rounded-md border border-neutral-300 bg-white px-2 text-sm hover:bg-neutral-100 disabled:opacity-60"
                >
                  Remove {roleKey}
                </button>
              </form>
            ))
          : null}
      </div>

      {errorMessage === null ? null : (
        <p role="alert" className="text-danger-700 text-sm">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
