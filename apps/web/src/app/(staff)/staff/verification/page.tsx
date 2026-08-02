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
  QueueFilters,
  REGISTRY_PERMISSIONS,
  VerificationQueue,
  listVerificationQueue,
  queueFilterSchema,
} from '@/features/registry'

export const metadata: Metadata = {
  title: 'Verification queue',
  robots: { index: false, follow: false },
}

/**
 * Staff verification queue (Slice 2D). Gated on `verification.read`; the
 * service re-checks the same capability with an audited denial, and RLS
 * constrains every row regardless.
 *
 * URL discipline: `state` (fixed vocabulary) and `page` (number) are the ONLY
 * parameters this route accepts. Anything else fails the schema parse and the
 * page falls back to its defaults — unvalidated input is never echoed
 * (P6-C-E).
 */
export default async function VerificationQueuePage({
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
  if (!active || !can(context, active.barangayId, REGISTRY_PERMISSIONS.verificationRead)) {
    redirect('/access-denied')
  }

  const raw = await searchParams
  const parsed = queueFilterSchema.safeParse(raw)
  const filter = parsed.success ? parsed.data : {}

  const result = await listVerificationQueue(active.barangayId, {
    state: filter.state,
    page: filter.page,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Verification queue — {active.barangayName}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Oldest submissions first. Open an application to review it and act.
        </p>
      </div>

      <QueueFilters active={result.stateFilter} />

      <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
        <h2 id="queue-heading" className="sr-only-focusable">
          Applications
        </h2>
        <VerificationQueue
          entries={result.entries}
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          stateFilter={result.stateFilter}
        />
      </section>
    </div>
  )
}
