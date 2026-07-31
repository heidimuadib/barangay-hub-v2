import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
  // A credential screen must never be indexed.
  robots: { index: false, follow: false },
}

/**
 * AUT-01 placeholder.
 *
 * The real sign-in screen — email/password, rate limiting, uniform failure
 * messaging, and the deliberate absence of any "account not found" distinction
 * (Phase 5 §11.2) — is built in Slice 1 / US-AUT-002.
 */
export default function SignInPage() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-brand-700 text-sm font-medium tracking-wide uppercase">Slice 0a</p>
      <h1 className="mt-2 text-xl font-bold">Sign in</h1>
      <p className="mt-3 text-neutral-700">
        The authentication screens are implemented in Slice 1. This placeholder confirms the auth
        shell renders in isolation from the public and staff shells.
      </p>
    </div>
  )
}
