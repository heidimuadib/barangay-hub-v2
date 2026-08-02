'use client'

import { useActionState } from 'react'

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
    <form action={formAction} noValidate>
      {errorMessage === null ? null : (
        <p
          role="alert"
          className="border-danger-100 text-danger-700 mb-4 rounded-md border bg-white px-3 py-2 text-sm"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-neutral-900">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
        />
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-neutral-900">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-700 hover:bg-brand-800 mt-6 min-h-11 w-full rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
