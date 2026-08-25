'use client'

import { useActionState } from 'react'

import { Alert, Button, FormField, Input } from '@/components/ui'
import type { Result } from '@/lib/errors'

import { signInAction } from '../actions/sign-in'

/**
 * US-AUT-002. Uniform failure messaging — the form renders exactly the copy
 * the action returns and never distinguishes failure causes.
 */
export function SignInForm() {
  const [state, formAction, isPending] = useActionState<Result<never> | null, FormData>(
    signInAction,
    null,
  )

  const errorMessage = state && !state.ok ? state.error.message : null

  return (
    <form action={formAction} noValidate className="space-y-4">
      {errorMessage === null ? null : (
        <Alert tone="danger" live="alert" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <FormField id="email" label="Email address" required>
        {(field) => (
          <Input
            {...field}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
          />
        )}
      </FormField>

      <FormField id="password" label="Password" required>
        {(field) => (
          <Input {...field} name="password" type="password" autoComplete="current-password" />
        )}
      </FormField>

      <div className="pt-2">
        <Button type="submit" variant="primary" size="md" disabled={isPending} className="w-full">
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </div>
    </form>
  )
}
