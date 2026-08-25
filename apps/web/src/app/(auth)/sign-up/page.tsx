import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card } from '@/components/ui'
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
    <Card className="w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Create an account</h1>
        <p className="text-dense mt-1.5 text-neutral-600">
          Create an account to start your resident registration. Your barangay confirms your details
          afterwards.
        </p>
      </div>

      <SignUpForm />

      <div className="mt-6 border-t border-neutral-200 pt-4 text-center">
        <p className="text-sm text-neutral-600">
          Already have an account?{' '}
          <Link
            href="/sign-in"
            className="text-brand-700 hover:text-brand-800 focus-visible:outline-brand-700 inline-flex min-h-11 items-center rounded-xs font-semibold underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </Card>
  )
}
