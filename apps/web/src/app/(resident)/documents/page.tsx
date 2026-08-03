import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import {
  CatalogList,
  EligibilityNotice,
  eligibilityNextRoute,
  getResidentCatalog,
  getResidentStanding,
  presentTerms,
  requestEligibility,
} from '@/features/documents'

export const metadata: Metadata = {
  title: 'Documents',
  robots: { index: false, follow: false },
}

/**
 * The resident document catalog (Slice 3B).
 *
 * Browsing needs MEMBERSHIP; requesting needs VERIFICATION. Splitting the two
 * is deliberate: an applicant waiting on a decision can see what their
 * barangay offers and what each document needs, so they arrive prepared
 * instead of discovering the requirements only once they are allowed to act.
 *
 * The commercial terms are classified here, on the server, by the same rule
 * every other surface uses — a card cannot render a fee without the status
 * that qualifies it (B-08 / RES-06).
 *
 * The US-UI-006 PUBLIC catalog is a different surface with a different
 * audience, and needs an `anon` grant 3A deliberately withheld. It is 3D.
 */
export default async function DocumentCatalogPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active) {
    redirect('/access-denied')
  }

  const [entries, standing] = await Promise.all([
    getResidentCatalog(active.barangayId),
    getResidentStanding(active.barangayId),
  ])

  const eligibility = requestEligibility(standing)
  const items = entries.map((entry) => ({ entry, terms: presentTerms(entry.terms) }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Documents from {active.barangayName}</h1>
        <p className="mt-2 text-neutral-700">
          Choose a document to see what it needs before you request it.
        </p>
      </div>

      {eligibility === 'eligible' ? null : (
        <EligibilityNotice
          eligibility={eligibility}
          nextRoute={eligibilityNextRoute(eligibility)}
        />
      )}

      <CatalogList items={items} />
    </div>
  )
}
