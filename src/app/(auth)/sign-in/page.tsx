import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

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
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-bold">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-500">
        Barangay Hub — resident services and barangay administration.
      </p>
      <SignInForm />
      <p className="mt-6 text-sm text-neutral-500">
        Accounts are provisioned by your barangay. If you do not have one yet, contact the barangay
        office.
      </p>
    </div>
  )
}
