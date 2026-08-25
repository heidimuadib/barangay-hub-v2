import Link from 'next/link'

import { Badge, type BadgeTone, Card, buttonClasses } from '@/components/ui'

import type { DocumentRequestState, OwnRequestSummary } from '../types/documents'

/**
 * The resident's own requests (Slice 3B, US-RES-004).
 *
 * Every row is one of the caller's own: ownership is enforced by RLS, by an
 * explicit `person_id` filter in the query, and again when the detail page is
 * opened. Nothing here carries a name, an address or a purpose — the list is
 * a tracker, and the free text lives one click away behind another check.
 */

const STATE_COPY: Record<DocumentRequestState, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft — not sent', tone: 'neutral' },
  submitted: { label: 'Waiting for review', tone: 'info' },
  in_review: { label: 'Being processed', tone: 'info' },
  ready_for_issue: { label: 'Ready to collect', tone: 'success' },
}

export function RequestStateChip({ state }: { state: DocumentRequestState }) {
  const copy = STATE_COPY[state]
  return <Badge tone={copy.tone}>{copy.label}</Badge>
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
      <Card>
        <p className="text-neutral-700">You have not requested any documents yet.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={entry.requestId}>
            <Card className="flex flex-wrap items-center justify-between gap-4 p-4 hover:border-neutral-300">
              <div className="flex flex-col gap-1">
                <Link
                  href={`/requests/${entry.requestId}`}
                  className="text-brand-700 hover:text-brand-800 focus-visible:outline-brand-700 inline-flex min-h-11 items-center font-semibold hover:underline"
                >
                  {/* A withdrawn type can still be named by an old request; if
                      it has become unreadable, say so rather than render a gap. */}
                  {entry.documentTypeName ?? 'Document no longer offered'}
                </Link>
                <span className="text-dense text-neutral-500">
                  Started {formatMoment(entry.createdAt)}
                  {entry.submittedAt ? ` · Sent ${formatMoment(entry.submittedAt)}` : ''}
                </span>
              </div>
              <RequestStateChip state={entry.state} />
            </Card>
          </li>
        ))}
      </ul>

      {pageCount > 1 ? (
        <nav aria-label="Request pages" className="flex flex-wrap items-center gap-3 pt-2">
          {page > 1 ? (
            <Link
              href={`/requests?page=${page - 1}`}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              Previous
            </Link>
          ) : null}
          <span className="text-dense text-neutral-500">
            Page {page} of {pageCount} · {total} request{total === 1 ? '' : 's'}
          </span>
          {page < pageCount ? (
            <Link
              href={`/requests?page=${page + 1}`}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
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
