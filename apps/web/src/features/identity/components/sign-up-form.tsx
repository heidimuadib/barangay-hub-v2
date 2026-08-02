'use client'

import { useActionState } from 'react'

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
      <div role="status" className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-bold">Check your email</h2>
        <p className="mt-3 text-neutral-700">
          If that address can be registered, we have sent it a confirmation link. Open the link to
          confirm your email, then sign in to complete your registration.
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Creating an account does not by itself register you as a resident — a barangay reviewer
          checks your details afterwards.
        </p>
        <a
          href="/sign-in"
          className="bg-brand-700 hover:bg-brand-800 mt-6 inline-block min-h-11 rounded-md px-4 py-2 font-medium text-white"
        >
          Go to sign in
        </a>
      </div>
    )
  }

  return (
    <form action={formAction} noValidate>
      {generalError === null ? null : (
        <p
          role="alert"
          className="border-danger-100 text-danger-700 mb-4 rounded-md border bg-white px-3 py-2 text-sm"
        >
          {generalError}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-email" className="text-sm font-medium text-neutral-900">
          Email address
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          {...(fieldErrors.email ? { 'aria-invalid': true } : {})}
          aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
        />
        {fieldErrors.email ? (
          <p id="signup-email-error" role="alert" className="text-danger-700 text-sm">
            {fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor="signup-password" className="text-sm font-medium text-neutral-900">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          {...(fieldErrors.password ? { 'aria-invalid': true } : {})}
          aria-describedby="signup-password-hint"
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
        />
        <p id="signup-password-hint" className="text-sm text-neutral-500">
          At least 12 characters. Use something you do not use elsewhere.
        </p>
        {fieldErrors.password ? (
          <p role="alert" className="text-danger-700 text-sm">
            {fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor="signup-confirm" className="text-sm font-medium text-neutral-900">
          Confirm password
        </label>
        <input
          id="signup-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          {...(fieldErrors.confirmPassword ? { 'aria-invalid': true } : {})}
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
        />
        {fieldErrors.confirmPassword ? (
          <p role="alert" className="text-danger-700 text-sm">
            {fieldErrors.confirmPassword[0]}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-700 hover:bg-brand-800 mt-6 min-h-11 w-full rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  )
}
