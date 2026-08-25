import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { Card, CardBody, CardHeader, PageHeader, buttonClasses } from '@/components/ui'
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
    <div className="space-y-6">
      <div>
        <Link
          href="/documents"
          className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center text-sm font-medium hover:underline"
        >
          &larr; All documents
        </Link>
        <div className="mt-2">
          <PageHeader title={detail.entry.name} description={detail.entry.description} />
        </div>
      </div>

      <section aria-labelledby="terms-heading">
        <Card>
          <CardHeader id="terms-heading" as="h2" title="Fee and processing" />
          <CardBody>
            <DocumentTerms terms={terms} headingId="terms-heading" />
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="requirements-heading">
        <Card>
          <CardHeader id="requirements-heading" as="h2" title="What you will be asked" />
          <CardBody className="space-y-4">
            <RequirementList requirements={detail.requirements} />
            {detail.entry.requiresSupportingEvidence ? (
              <p className="text-dense rounded-md bg-neutral-50 p-3 text-neutral-600">
                This document also needs supporting documents. Uploading them here is not available
                yet — bring them to the barangay office.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </section>

      {eligibility === 'eligible' ? (
        <div className="pt-2">
          <Link
            href={`/requests/new?type=${detail.entry.documentTypeId}`}
            className={buttonClasses({ variant: 'primary' })}
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
