'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Alert, Button, FormField, Input, buttonClasses } from '@/components/ui'
import type { Result } from '@/lib/errors'

import { signUpAction } from '../actions/sign-up'

/**
 * Public sign-up form. The success panel is the ONLY positive outcome the
 * server ever reports, whether or not the address already had an account
 * (ADR-0006 anti-enumeration posture).
 */
export function SignUpForm() {
  const [state, formAction, isPending] = useActionState<Result<{ pending: true }> | null, FormData>(
    signUpAction,
    null,
  )

  const fieldErrors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {}
  const generalError =
    state && !state.ok && Object.keys(fieldErrors).length === 0 ? state.error.message : null

  if (state?.ok === true) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Check your email">
          <p className="mt-1 text-sm text-neutral-700">
            If that address can be registered, we have sent it a confirmation link. Open the link to
            confirm your email, then sign in to complete your registration.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Creating an account does not by itself register you as a resident — a barangay reviewer
            checks your details afterwards.
          </p>
        </Alert>

        <div className="pt-2">
          <Link
            href="/sign-in"
            className={buttonClasses({ variant: 'primary', className: 'w-full' })}
          >
            Go to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      {generalError === null ? null : (
        <Alert tone="danger" live="alert" className="mb-4">
          {generalError}
        </Alert>
      )}

      <FormField id="signup-email" label="Email address" error={fieldErrors.email?.[0]} required>
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

      <FormField
        id="signup-password"
        label="Password"
        description="At least 12 characters. Use something you do not use elsewhere."
        error={fieldErrors.password?.[0]}
        required
      >
        {(field) => (
          <Input {...field} name="password" type="password" autoComplete="new-password" />
        )}
      </FormField>

      <FormField
        id="signup-confirm"
        label="Confirm password"
        error={fieldErrors.confirmPassword?.[0]}
        required
      >
        {(field) => (
          <Input {...field} name="confirmPassword" type="password" autoComplete="new-password" />
        )}
      </FormField>

      <div className="pt-2">
        <Button type="submit" variant="primary" size="md" disabled={isPending} className="w-full">
          {isPending ? 'Creating your account…' : 'Create account'}
        </Button>
      </div>
    </form>
  )
}
