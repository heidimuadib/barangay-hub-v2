import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import {
  EligibilityNotice,
  RequestList,
  eligibilityNextRoute,
  getResidentStanding,
  listOwnRequestPage,
  requestEligibility,
} from '@/features/documents'

export const metadata: Metadata = {
  title: 'My requests',
  robots: { index: false, follow: false },
}

/**
 * The resident's own document requests (Slice 3B, US-RES-004).
 *
 * Own-means-own three times over: RLS scopes the table to the requester, the
 * query filters by the caller's person id, and the detail page re-checks. Only
 * a page NUMBER is ever a URL parameter.
 */
export default async function RequestsPage({
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
  if (!active) {
    redirect('/access-denied')
  }

  const { page: rawPage } = await searchParams
  const page = Number.parseInt(rawPage ?? '1', 10)

  const [result, standing] = await Promise.all([
    listOwnRequestPage(active.barangayId, Number.isNaN(page) ? 1 : page),
    getResidentStanding(active.barangayId),
  ])

  const eligibility = requestEligibility(standing)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">My document requests</h1>
        {eligibility === 'eligible' ? (
          <Link
            href="/documents"
            className="bg-brand-700 hover:bg-brand-800 inline-flex min-h-11 items-center rounded-md px-4 py-2 font-medium text-white"
          >
            Request a document
          </Link>
        ) : null}
      </div>

      {eligibility === 'eligible' ? null : (
        <EligibilityNotice
          eligibility={eligibility}
          nextRoute={eligibilityNextRoute(eligibility)}
        />
      )}

      <RequestList
        entries={result.entries}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />
    </div>
  )
}
