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
import {
  DOCUMENT_PERMISSIONS,
  DocumentTerms,
  WalkInRequestForm,
  getDocumentTypeDetail,
  getResidentCatalog,
  presentTerms,
} from '@/features/documents'
import { getPersonDetail } from '@/features/registry'

export const metadata: Metadata = {
  title: 'File a document request',
  robots: { index: false, follow: false },
}

/**
 * Filing a document request at the counter (Slice 3C).
 *
 * Two opaque ids drive the screen: `person` and `type`. The person is chosen
 * from the REGISTRY, which already handles search, duplicates and tenant
 * scope — building a second person-picker here would drift from it, exactly as
 * a second document picker would drift from the catalog.
 *
 * Gated on `requests.create_walk_in`. Under the ADR-0006 mapping that is an
 * administrator capability, so front-desk staff who may review requests still
 * cannot file one for somebody else.
 */
export default async function WalkInRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; type?: string }>
}) {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, DOCUMENT_PERMISSIONS.createWalkIn)) {
    redirect('/access-denied')
  }

  const { person: personId, type: documentTypeId } = await searchParams

  // Step 1 — who is this for? The registry owns finding people.
  if (!personId) {
    return (
      <Shell>
        <p className="text-neutral-700">
          Find the resident in the registry first, then file the request from their record.
        </p>
        <div>
          <Link
            href="/staff/registry"
            className="bg-brand-700 hover:bg-brand-800 inline-flex min-h-11 items-center rounded-md px-4 py-2 font-medium text-white"
          >
            Open the registry
          </Link>
        </div>
      </Shell>
    )
  }

  const person = await getPersonDetail(active.barangayId, personId)
  if (!person) {
    notFound()
  }

  // Step 2 — which document? Straight from the tenant's own active catalog.
  if (!documentTypeId) {
    const catalog = await getResidentCatalog(active.barangayId)
    return (
      <Shell>
        <p className="text-neutral-700">
          Choose the document <span className="font-medium">{person.fullName}</span> is asking for.
        </p>
        {catalog.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700">
            This barangay has no active document types yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {catalog.map((entry) => (
              <li key={entry.documentTypeId}>
                <Link
                  href={`/staff/requests/new?person=${personId}&type=${entry.documentTypeId}`}
                  className="text-brand-700 inline-flex min-h-11 items-center font-medium underline"
                >
                  {entry.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Shell>
    )
  }

  const detail = await getDocumentTypeDetail(active.barangayId, documentTypeId)
  if (!detail) {
    notFound()
  }

  return (
    <Shell>
      <section
        aria-labelledby="terms-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="terms-heading" className="text-lg font-bold">
          Fee and processing
        </h2>
        <div className="mt-3">
          <DocumentTerms terms={presentTerms(detail.entry.terms)} headingId="terms-heading" />
        </div>
      </section>

      <WalkInRequestForm
        barangayId={active.barangayId}
        personId={person.personId}
        personName={person.fullName}
        documentTypeId={detail.entry.documentTypeId}
        documentTypeName={detail.entry.name}
        requirements={detail.requirements}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/staff/requests"
          className="text-brand-700 inline-flex min-h-11 items-center hover:underline"
        >
          ← Document requests
        </Link>
        <h1 className="mt-2 text-xl font-bold">File a document request</h1>
      </div>
      {children}
    </div>
  )
}
