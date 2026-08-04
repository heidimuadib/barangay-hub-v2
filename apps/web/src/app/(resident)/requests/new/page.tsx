import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import {
  DocumentTerms,
  EligibilityNotice,
  RequestForm,
  eligibilityNextRoute,
  getDocumentTypeDetail,
  getResidentStanding,
  presentTerms,
  requestEligibility,
} from '@/features/documents'

export const metadata: Metadata = {
  title: 'Request a document',
  robots: { index: false, follow: false },
}

/**
 * Composing a new request (Slice 3B).
 *
 * The verification gate is enforced in THREE places and this is the least
 * important of them: the page hides the form, the Server Action refuses the
 * call, and `create_own_request` raises RESIDENT_NOT_VERIFIED. The page's job
 * is only to explain, so nobody is left at a form that would fail on submit.
 *
 * `?type=` carries an opaque document-type UUID — never a resident id, and
 * never anything a person could be identified from (P6-C-E).
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
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

  const standing = await getResidentStanding(active.barangayId)
  const eligibility = requestEligibility(standing)

  if (eligibility !== 'eligible') {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold">Request a document</h1>
        <EligibilityNotice
          eligibility={eligibility}
          nextRoute={eligibilityNextRoute(eligibility)}
        />
      </div>
    )
  }

  const { type } = await searchParams

  // No document chosen yet: send them to the catalog rather than inventing a
  // second, competing picker that would drift from it.
  if (!type) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold">Request a document</h1>
        <p className="text-neutral-700">Choose the document you need first.</p>
        <div>
          <Link
            href="/documents"
            className="bg-brand-700 hover:bg-brand-800 inline-flex min-h-11 items-center rounded-md px-4 py-2 font-medium text-white"
          >
            Browse documents
          </Link>
        </div>
      </div>
    )
  }

  const detail = await getDocumentTypeDetail(active.barangayId, type)
  if (!detail) {
    notFound()
  }

  const terms = presentTerms(detail.entry.terms)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/documents/${detail.entry.documentTypeId}`}
          className="text-brand-700 inline-flex min-h-11 items-center hover:underline"
        >
          ← {detail.entry.name}
        </Link>
        <h1 className="mt-2 text-xl font-bold">Request {detail.entry.name}</h1>
      </div>

      <section
        aria-labelledby="terms-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="terms-heading" className="text-lg font-bold">
          Fee and processing
        </h2>
        <div className="mt-3">
          <DocumentTerms terms={terms} headingId="terms-heading" />
        </div>
      </section>

      <RequestForm
        barangayId={active.barangayId}
        documentTypeId={detail.entry.documentTypeId}
        documentTypeName={detail.entry.name}
        requirements={detail.requirements}
      />
    </div>
  )
}
