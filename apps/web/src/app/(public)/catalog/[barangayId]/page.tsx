import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  CatalogList,
  getPublicBarangays,
  getPublicCatalog,
  presentTerms,
} from '@/features/documents'

export const metadata: Metadata = {
  title: 'Documents',
  description: 'What this barangay issues, what each document needs, and what it costs.',
}

/**
 * One barangay's public catalog (US-UI-006).
 *
 * Reachable with no session. It reuses the SAME `CatalogList` and
 * `presentTerms` the resident surface uses, which is the point: a fee that is
 * marked unconfirmed for a signed-in resident is marked unconfirmed for an
 * anonymous visitor too, because there is one presentation rule and not two.
 *
 * The URL carries an opaque barangay UUID. Nothing here is personal data — a
 * barangay's own catalog is public information by definition — but the
 * no-parameter discipline holds anyway, so a shared link reveals only which
 * barangay was being looked at.
 */
export default async function PublicCatalogPage({
  params,
}: {
  params: Promise<{ barangayId: string }>
}) {
  const { barangayId } = await params

  // The directory is the authority on which barangays are publicly listed; an
  // id that is not in it is not found, whether it is inactive or invented.
  const barangays = await getPublicBarangays()
  const barangay = barangays.find((candidate) => candidate.id === barangayId)
  if (!barangay) {
    notFound()
  }

  const entries = await getPublicCatalog(barangayId)
  const items = entries.map((entry) => ({ entry, terms: presentTerms(entry.terms) }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-brand-700 inline-flex min-h-11 items-center hover:underline">
          ← All barangays
        </Link>
        <h1 className="mt-2 text-xl font-bold">Documents from {barangay.name}</h1>
        <p className="mt-2 text-neutral-700">
          What this barangay issues and what each document asks for. To request one you will need an
          account, and the barangay will confirm your registration first.
        </p>
      </div>

      {/* Deliberately the resident component. A public catalog that drifted
          from the resident one would eventually promise something different
          to the two audiences — and the difference nobody would notice is the
          B-08 marking. */}
      <CatalogList items={items} publicView />

      <div>
        <Link
          href="/sign-in"
          className="bg-brand-700 hover:bg-brand-800 inline-flex min-h-11 items-center rounded-md px-4 py-2 font-medium text-white"
        >
          Sign in to request a document
        </Link>
      </div>
    </div>
  )
}
