import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  can,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import { REGISTRY_PERMISSIONS, WalkInForm } from '@/features/registry'

export const metadata: Metadata = {
  title: 'Add a walk-in resident',
  robots: { index: false, follow: false },
}

/**
 * Walk-in creation (Slice 2C). Requires `registry.create_walk_in`, which the
 * ADR-0006 mapping grants to barangay administrators only — `barangay_staff`
 * reaches the registry list but not this page, and the database refuses the
 * write regardless of what the UI offers.
 */
export default async function NewWalkInPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, REGISTRY_PERMISSIONS.createWalkIn)) {
    redirect('/access-denied')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Add a walk-in resident</h1>
        <p className="mt-2 max-w-prose text-neutral-700">
          For someone registering at the counter. They do not need an email address or an online
          account — you can link one later if they create it.
        </p>
      </div>

      <WalkInForm barangayId={active.barangayId} />

      <p className="text-sm text-neutral-500">
        <Link href="/staff/registry" className="text-brand-700 underline">
          Back to the registry
        </Link>
      </p>
    </div>
  )
}
