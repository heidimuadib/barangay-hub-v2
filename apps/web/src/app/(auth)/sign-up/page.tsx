import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignUpForm, getAuthorizationContext, landingRouteFor } from '@/features/identity'

export const metadata: Metadata = {
  title: 'Create an account',
  robots: { index: false, follow: false },
}

/**
 * Public sign-up (ADR-0006 Option C). Nothing on this page enumerates
 * tenants or residents: no barangay list, no membership hints — the barangay
 * is chosen during onboarding, after the account exists.
 */
export default async function SignUpPage() {
  const context = await getAuthorizationContext()
  if (context) {
    redirect(landingRouteFor(context))
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-bold">Create an account</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-500">
        An account lets you start your resident registration. Your barangay confirms your details
        afterwards.
      </p>
      <SignUpForm />
      <p className="mt-6 text-sm text-neutral-500">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-brand-700 underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  )
}
