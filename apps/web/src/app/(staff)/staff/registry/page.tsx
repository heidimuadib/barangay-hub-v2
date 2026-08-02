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
import {
  REGISTRY_PERMISSIONS,
  RegistrySearch,
  RegistryTable,
  listRegistry,
} from '@/features/registry'

export const metadata: Metadata = {
  title: 'Resident registry',
  robots: { index: false, follow: false },
}

/**
 * Tenant resident registry (Slice 2C). Gated on `registry.read`; the service
 * re-checks the same capability with an audited denial, and RLS constrains
 * every row regardless.
 *
 * Only a page NUMBER is ever a URL parameter — search runs through a POST
 * Server Action so no resident detail can appear in a shareable link.
 */
export default async function RegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
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

  const { page: rawPage } = await searchParams
  const page = Number.parseInt(rawPage ?? '1', 10)
  const result = await listRegistry(active.barangayId, Number.isNaN(page) ? 1 : page)

  const canCreateWalkIn = can(context, active.barangayId, REGISTRY_PERMISSIONS.createWalkIn)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Resident registry — {active.barangayName}</h1>
        {canCreateWalkIn ? (
          <Link
            href="/staff/registry/new"
            className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white"
          >
            Add a walk-in resident
          </Link>
        ) : null}
      </div>

      <RegistrySearch barangayId={active.barangayId} />

      <section aria-labelledby="registry-list-heading" className="flex flex-col gap-3">
        <h2 id="registry-list-heading" className="text-lg font-bold">
          All residents
        </h2>
        <RegistryTable
          entries={result.entries}
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
        />
      </section>
    </div>
  )
}
