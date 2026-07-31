'use client'

import { useEffect } from 'react'

/**
 * Route-segment error boundary.
 *
 * Shows approved copy and a correlation reference — never the thrown message.
 * In production Next.js already strips server error messages before they reach
 * the client, but relying on that alone would make the page leak in development
 * habits that then get copied into new code (Phase 5 §36.2).
 *
 * `error.digest` is the value Next.js also writes to the server log, which is
 * what makes a support call resolvable.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Structured reporting is wired to Sentry in Slice 1 (US-OPS-003).
    // Until then the browser console keeps the digest visible during development.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console -- development-only diagnostic
      console.error('Route error', error.digest ?? '(no digest)', error)
    }
  }, [error])

  return (
    <div
      role="alert"
      className="border-danger-100 mx-auto max-w-prose rounded-lg border bg-white p-6"
    >
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-neutral-700">
        We could not complete that request. Nothing you submitted was lost — you can try again.
      </p>
      <p className="mt-3 text-neutral-700">
        If it keeps happening, contact the barangay office and give them this reference.
      </p>
      <p className="mt-2">
        <span className="text-sm text-neutral-500">Reference: </span>
        <code className="tabular rounded bg-neutral-100 px-2 py-1 text-sm">
          {error.digest ?? 'unavailable'}
        </code>
      </p>
      <button
        type="button"
        onClick={reset}
        // min-h-11 is 44px — the minimum touch target (Phase 5 §8.7).
        className="bg-brand-700 hover:bg-brand-800 mt-6 min-h-11 rounded-md px-4 py-2 font-medium text-white"
      >
        Try again
      </button>
    </div>
  )
}
