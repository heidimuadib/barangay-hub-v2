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
  RequirementList,
  eligibilityNextRoute,
  getDocumentTypeDetail,
  getResidentStanding,
  presentTerms,
  requestEligibility,
} from '@/features/documents'

export const metadata: Metadata = {
  title: 'Document details',
  robots: { index: false, follow: false },
}

/**
 * One document type (Slice 3B).
 *
 * The URL carries an opaque document-type UUID and nothing else (P6-C-E) — no
 * resident identifier, no name, no request id.
 *
 * A withdrawn type, a type belonging to another barangay and a type that never
 * existed all render the same not-found: the page must not become a way to
 * enumerate another tenant's catalog (Phase 4 §13.6).
 */
export default async function DocumentTypePage({
  params,
}: {
  params: Promise<{ documentTypeId: string }>
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

  const { documentTypeId } = await params
  const [detail, standing] = await Promise.all([
    getDocumentTypeDetail(active.barangayId, documentTypeId),
    getResidentStanding(active.barangayId),
  ])
  if (!detail) {
    notFound()
  }

  const eligibility = requestEligibility(standing)
  const terms = presentTerms(detail.entry.terms)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/documents"
          className="text-brand-700 inline-flex min-h-11 items-center hover:underline"
        >
          ← All documents
        </Link>
        <h1 className="mt-2 text-xl font-bold">{detail.entry.name}</h1>
        {detail.entry.description ? (
          <p className="mt-2 text-neutral-700">{detail.entry.description}</p>
        ) : null}
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

      <section
        aria-labelledby="requirements-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="requirements-heading" className="text-lg font-bold">
          What you will be asked
        </h2>
        <div className="mt-3">
          <RequirementList requirements={detail.requirements} />
        </div>
        {detail.entry.requiresSupportingEvidence ? (
          <p className="mt-3 text-sm text-neutral-700">
            This document also needs supporting documents. Uploading them here is not available yet
            — bring them to the barangay office.
          </p>
        ) : null}
      </section>

      {eligibility === 'eligible' ? (
        <div>
          <Link
            href={`/requests/new?type=${detail.entry.documentTypeId}`}
            className="bg-brand-700 hover:bg-brand-800 inline-flex min-h-11 items-center rounded-md px-4 py-2 font-medium text-white"
          >
            Request this document
          </Link>
        </div>
      ) : (
        <EligibilityNotice
          eligibility={eligibility}
          nextRoute={eligibilityNextRoute(eligibility)}
        />
      )}
    </div>
  )
}
