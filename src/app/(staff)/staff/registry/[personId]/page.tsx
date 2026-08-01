import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  can,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import { REGISTRY_PERMISSIONS, RESIDENCY_BASES, getPersonDetail } from '@/features/registry'

export const metadata: Metadata = {
  title: 'Resident record',
  robots: { index: false, follow: false },
}

/**
 * Safe staff view of one resident record (Slice 2C).
 *
 * Shows only what counter work needs: identity fields, account linkage,
 * verification status, residency basis and superseded state. Evidence
 * DOCUMENTS are not reachable here — that surface arrives with the Storage
 * broker in subpart 2F and behind `verification.evidence.read`.
 *
 * The URL carries an opaque person UUID and nothing else (P6-C-E).
 */
export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>
}) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, REGISTRY_PERMISSIONS.registryRead)) {
    redirect('/access-denied')
  }

  const { personId } = await params
  const person = await getPersonDetail(active.barangayId, personId)
  // A record in another barangay is indistinguishable from one that does not
  // exist (Phase 4 §13.6) — RLS returns nothing either way.
  if (!person) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">{person.fullName}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {active.barangayName} ·{' '}
          {person.sourceChannel === 'staff' ? 'recorded by staff (walk-in)' : 'self-registered'}
        </p>
      </div>

      {person.superseded ? (
        <p
          role="status"
          className="border-warning-100 rounded-lg border bg-white p-4 text-neutral-700"
        >
          This record was superseded during duplicate resolution. It is kept for history and cannot
          be edited.
        </p>
      ) : null}

      <dl className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-neutral-500">Date of birth</dt>
          <dd className="tabular mt-1 text-neutral-900">{person.birthdate ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Residency basis</dt>
          <dd className="mt-1 text-neutral-900">
            {RESIDENCY_BASES[person.residencyBasisKey].label}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Online account</dt>
          <dd className="mt-1 text-neutral-900">
            {person.hasAccount ? 'Linked to an account' : 'No account linked'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Verification</dt>
          <dd className="mt-1 text-neutral-900">
            {person.verificationState ?? 'No application yet'}
          </dd>
        </div>
      </dl>

      <p className="text-sm text-neutral-500">
        Reviewing evidence documents and deciding applications arrive in the next updates.
      </p>

      <p className="text-sm text-neutral-500">
        <Link href="/staff/registry" className="text-brand-700 underline">
          Back to the registry
        </Link>
      </p>
    </div>
  )
}
