import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card } from '@/components/ui'
import { SignInForm, getAuthorizationContext, landingRouteFor } from '@/features/identity'

export const metadata: Metadata = {
  title: 'Sign in',
  // A credential screen must never be indexed.
  robots: { index: false, follow: false },
}

/**
 * US-AUT-002. The screen shows the barangay-hub identity and a credential
 * form, nothing else — nothing here may enumerate tenants or residents
 * (Phase 5 §11.1).
 */
export default async function SignInPage() {
  const context = await getAuthorizationContext()
  if (context) {
    redirect(landingRouteFor(context))
  }

  return (
    <Card className="w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Sign in</h1>
        <p className="text-dense mt-1.5 text-neutral-600">
          Sign in with your registered email and password to access resident services.
        </p>
      </div>

      <SignInForm />

      <div className="mt-6 border-t border-neutral-200 pt-4 text-center">
        <p className="text-sm text-neutral-600">
          New here?{' '}
          <Link
            href="/sign-up"
            className="text-brand-700 hover:text-brand-800 focus-visible:outline-brand-700 inline-flex min-h-11 items-center rounded-xs font-semibold underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
        <p className="text-dense mt-2 text-neutral-500">
          Your barangay can also register your account in person at the barangay hall.
        </p>
      </div>
    </Card>
  )
}
