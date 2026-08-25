'use client'

import { useActionState } from 'react'

import { Alert, Button, FormField, Input } from '@/components/ui'
import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import { updateProfileAction } from '../actions/update-profile'

export function ProfileForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [state, formAction, isPending] = useActionState<
    Result<{ displayName: string }> | null,
    FormData
  >(updateProfileAction, null)

  // The form shows the saved value from action state, but the surrounding
  // server-rendered shell still holds the previous name until refetched.
  useRefreshOnSuccess([state])

  const fieldError = state && !state.ok ? (state.error.fieldErrors?.displayName?.[0] ?? null) : null
  const errorMessage = state && !state.ok && fieldError === null ? state.error.message : null
  const savedName = state?.ok === true ? state.data.displayName : null

  return (
    <form action={formAction} noValidate className="space-y-4">
      {errorMessage === null ? null : (
        <Alert tone="danger" live="alert">
          {errorMessage}
        </Alert>
      )}

      {savedName === null ? null : (
        <p role="status" className="text-dense text-success-700 font-medium">
          Display name saved.
        </p>
      )}

      <FormField
        id="displayName"
        label="Display name"
        description="Shown to barangay staff on the member roster. This is the only profile field you can change here."
        error={fieldError}
        required
      >
        {(field) => (
          <Input
            {...field}
            name="displayName"
            maxLength={120}
            defaultValue={savedName ?? initialDisplayName}
          />
        )}
      </FormField>

      <div className="pt-2">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
