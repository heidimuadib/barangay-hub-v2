import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'

export const metadata: Metadata = {
  title: 'Staff workspace',
  robots: { index: false, follow: false },
}

/**
 * Slice 1 staff home: proves the tenant context. The real staff home —
 * today's queues, SLA breach counts, pending approvals — is Slice 2 /
 * US-STF-003.
 */
export default async function StaffHomePage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-bold">Staff workspace</h1>
      {active ? (
        <>
          <p className="mt-2 text-neutral-700">
            You are working in <span className="font-medium">{active.barangayName}</span> as{' '}
            {active.roles.length > 0 ? active.roles.join(', ') : 'a member'}.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Queues, requests and reports arrive with their slices. Member administration and the
            audit log are available from the navigation above.
          </p>
        </>
      ) : (
        <p className="mt-2 text-neutral-700">No active barangay membership was found.</p>
      )}
    </div>
  )
}
