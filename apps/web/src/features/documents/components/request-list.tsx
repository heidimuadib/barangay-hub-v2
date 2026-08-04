import Link from 'next/link'

import type { DocumentRequestState, OwnRequestSummary } from '../types/documents'

/**
 * The resident's own requests (Slice 3B, US-RES-004).
 *
 * Every row is one of the caller's own: ownership is enforced by RLS, by an
 * explicit `person_id` filter in the query, and again when the detail page is
 * opened. Nothing here carries a name, an address or a purpose — the list is
 * a tracker, and the free text lives one click away behind another check.
 */

const STATE_COPY: Record<DocumentRequestState, { label: string; tone: string }> = {
  draft: { label: 'Draft — not sent', tone: 'bg-neutral-100 text-neutral-700' },
  submitted: { label: 'Waiting for review', tone: 'bg-info-100 text-info-700' },
  in_review: { label: 'Being processed', tone: 'bg-info-100 text-info-700' },
  ready_for_issue: { label: 'Ready to collect', tone: 'bg-success-100 text-success-700' },
}

export function RequestStateChip({ state }: { state: DocumentRequestState }) {
  const copy = STATE_COPY[state]
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${copy.tone}`}>
      {copy.label}
    </span>
  )
}

export function RequestList({
  entries,
  page,
  pageCount,
  total,
}: {
  entries: readonly OwnRequestSummary[]
  page: number
  pageCount: number
  total: number
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700">
        You have not requested any documents yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li
            key={entry.requestId}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4"
          >
            <div className="flex flex-col gap-1">
              <Link
                href={`/requests/${entry.requestId}`}
                className="text-brand-700 inline-flex min-h-11 items-center font-medium hover:underline"
              >
                {/* A withdrawn type can still be named by an old request; if
                    it has become unreadable, say so rather than render a gap. */}
                {entry.documentTypeName ?? 'Document no longer offered'}
              </Link>
              <span className="text-sm text-neutral-500">
                Started {formatMoment(entry.createdAt)}
                {entry.submittedAt ? ` · Sent ${formatMoment(entry.submittedAt)}` : ''}
              </span>
            </div>
            <RequestStateChip state={entry.state} />
          </li>
        ))}
      </ul>

      {pageCount > 1 ? (
        <nav aria-label="Request pages" className="flex flex-wrap items-center gap-3">
          {page > 1 ? (
            <Link
              href={`/requests?page=${page - 1}`}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-100"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-sm text-neutral-500">
            Page {page} of {pageCount} · {total} request{total === 1 ? '' : 's'}
          </span>
          {page < pageCount ? (
            <Link
              href={`/requests?page=${page + 1}`}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-100"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  )
}

function formatMoment(value: string): string {
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
