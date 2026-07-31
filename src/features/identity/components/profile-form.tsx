'use client'

import { useActionState } from 'react'

import type { Result } from '@/lib/errors'

import { updateProfileAction } from '../actions/update-profile'

export function ProfileForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [state, formAction, isPending] = useActionState<
    Result<{ displayName: string }> | null,
    FormData
  >(updateProfileAction, null)

  const fieldError = state && !state.ok ? (state.error.fieldErrors?.displayName?.[0] ?? null) : null
  const errorMessage = state && !state.ok && fieldError === null ? state.error.message : null
  const savedName = state?.ok === true ? state.data.displayName : null

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-lg border border-neutral-200 bg-white p-6"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-sm font-medium text-neutral-900">
          Display name
        </label>
        <p id="displayName-help" className="text-sm text-neutral-500">
          Shown to barangay staff on the member roster. This is the only profile field you can
          change here.
        </p>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={120}
          defaultValue={savedName ?? initialDisplayName}
          aria-describedby="displayName-help"
          {...(fieldError === null ? {} : { 'aria-invalid': true })}
          className="mt-1 min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
        />
        {fieldError === null ? null : (
          <p role="alert" className="text-danger-700 text-sm">
            {fieldError}
          </p>
        )}
      </div>

      {savedName === null ? null : (
        <p role="status" className="text-success-700 mt-3 text-sm">
          Display name saved.
        </p>
      )}
      {errorMessage === null ? null : (
        <p role="alert" className="text-danger-700 mt-3 text-sm">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-700 hover:bg-brand-800 mt-4 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
