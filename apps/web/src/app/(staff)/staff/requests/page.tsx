import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  can,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import {
  DOCUMENT_PERMISSIONS,
  RequestQueue,
  RequestQueueFilters,
  listRequestQueue,
  requestQueueFilterSchema,
} from '@/features/documents'

export const metadata: Metadata = {
  title: 'Document requests',
  robots: { index: false, follow: false },
}

/**
 * The staff intake queue (Slice 3C) — the real staff home for document work.
 *
 * Gated on `requests.read`; the service re-checks the same capability with an
 * audited denial, and RLS constrains every row regardless.
 *
 * The URL carries a state key from a fixed vocabulary and a page number, and
 * nothing else. An unparseable value falls back to the defaults rather than
 * being echoed into the page (P6-C-E).
 */
export default async function StaffRequestQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>
}) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, DOCUMENT_PERMISSIONS.requestsRead)) {
    redirect('/access-denied')
  }

  const raw = await searchParams
  const parsed = requestQueueFilterSchema.safeParse(raw)
  const filter = parsed.success ? parsed.data : {}

  const result = await listRequestQueue(active.barangayId, {
    state: filter.state,
    page: filter.page,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Document requests — {active.barangayName}</h1>
      </div>

      <RequestQueueFilters active={result.stateFilter} />

      <RequestQueue
        entries={result.entries}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        stateFilter={result.stateFilter}
      />
    </div>
  )
}
