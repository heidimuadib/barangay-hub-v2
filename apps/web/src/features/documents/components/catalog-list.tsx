import Link from 'next/link'

import type { PresentedTerms } from '@/features/documents'

import type { CatalogEntry } from '../types/documents'
import { DocumentTerms } from './document-terms'

/**
 * The resident document catalog (Slice 3B).
 *
 * One card per ACTIVE document type. Inactive types never reach here — the
 * query, the RLS policy and `create_own_request` each exclude them
 * independently, so a withdrawn document cannot be browsed OR requested.
 *
 * Terms are pre-classified on the server (`presentTerms`), so every card shows
 * its fee with the qualifier that belongs to it.
 */

export interface CatalogCard {
  readonly entry: CatalogEntry
  readonly terms: PresentedTerms
}

export function CatalogList({ items }: { items: readonly CatalogCard[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700">
        Your barangay has not published any documents yet. Contact the barangay office if you need
        one.
      </p>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map(({ entry, terms }) => (
        <li
          key={entry.documentTypeId}
          className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-6"
        >
          <div>
            <h3 className="text-lg font-bold">
              {/* The whole card title is the target: a 44px row beats a
                  word-sized link on the phones most residents use. */}
              <Link
                href={`/documents/${entry.documentTypeId}`}
                className="text-brand-700 inline-flex min-h-11 items-center hover:underline"
              >
                {entry.name}
              </Link>
            </h3>
            {entry.description ? (
              <p className="mt-1 text-neutral-700">{entry.description}</p>
            ) : null}
          </div>

          <DocumentTerms terms={terms} />

          <p className="text-sm text-neutral-500">
            {entry.requirementCount === 0
              ? 'No extra questions.'
              : entry.requirementCount === 1
                ? '1 question to answer.'
                : `${entry.requirementCount} questions to answer.`}
            {entry.requiresSupportingEvidence ? ' Supporting documents are requested.' : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}
