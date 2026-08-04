import Link from 'next/link'

import type { DocumentRequestState, RequestQueueEntry } from '../types/documents'

/**
 * The staff intake queue (Slice 3C) — the real staff home for document work.
 *
 * Responsive like the Slice 2 queues: a real table from `sm` upwards, stacked
 * cards below it, because a five-column table is unreadable on the phones
 * barangay staff often work from. Both carry every row and every link.
 *
 * URL discipline: the ONLY parameters this surface produces are `state` (a key
 * from the fixed vocabulary) and `page` (a number). A requester's name appears
 * in link TEXT, never in a link TARGET (P6-C-E).
 */

/** Staff-facing labels: factual, not the resident's reassurance copy. */
const STAFF_STATE_LABELS: Record<DocumentRequestState, { label: string; tone: string }> = {
  draft: { label: 'draft', tone: 'bg-neutral-100 text-neutral-700' },
  submitted: { label: 'submitted', tone: 'bg-info-100 text-info-700' },
  in_review: { label: 'in review', tone: 'bg-info-100 text-info-700' },
  ready_for_issue: { label: 'ready for issue', tone: 'bg-success-100 text-success-700' },
}

export function RequestQueueChip({ state }: { state: DocumentRequestState }) {
  const copy = STAFF_STATE_LABELS[state]
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-sm ${copy.tone}`}>
      {copy.label}
    </span>
  )
}

/**
 * Filter chips. "Needs action" is the parameter-less default and matches the
 * service's actionable set — the states staff can actually move.
 *
 * `draft` is deliberately absent: a draft belongs to the resident composing
 * it and has not been sent to anyone. Offering staff a filter for other
 * people's unfinished work would be a surveillance surface, not a queue.
 */
const FILTERS: readonly { key: DocumentRequestState | null; label: string }[] = [
  { key: null, label: 'Needs action' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'in_review', label: 'In review' },
  { key: 'ready_for_issue', label: 'Ready for issue' },
]

export function RequestQueueFilters({ active }: { active: DocumentRequestState | null }) {
  return (
    <nav aria-label="Filter by state" className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = filter.key === active
        return (
          <Link
            key={filter.label}
            href={filter.key === null ? '/staff/requests' : `/staff/requests?state=${filter.key}`}
            {...(isActive ? { 'aria-current': 'page' as const } : {})}
            className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium ${
              isActive
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {filter.label}
          </Link>
        )
      })}
    </nav>
  )
}

function waitingSince(entry: RequestQueueEntry): string {
  return (entry.submittedAt ?? entry.createdAt).slice(0, 10)
}

/**
 * A requester whose name the caller may not read.
 *
 * Reachable only if a role holds `requests.read` without `registry.read`; the
 * ADR-0006 mapping gives both together. Stated rather than papered over — a
 * queue that printed "Unknown" would hide a capability-mapping mistake.
 */
const NAME_WITHHELD = 'Name not available to your role'

export function RequestQueue({
  entries,
  page,
  pageCount,
  total,
  stateFilter,
}: {
  entries: readonly RequestQueueEntry[]
  page: number
  pageCount: number
  total: number
  stateFilter: DocumentRequestState | null
}) {
  if (entries.length === 0) {
    return (
      <p
        role="status"
        className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700"
      >
        {stateFilter === null
          ? 'Nothing needs action right now. Requests appear here as residents submit them.'
          : `No request is currently ${STAFF_STATE_LABELS[stateFilter].label}.`}
      </p>
    )
  }

  const pageHref = (target: number) =>
    stateFilter === null
      ? `/staff/requests?page=${target}`
      : `/staff/requests?state=${stateFilter}&page=${target}`

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="text-dense hidden w-full text-left sm:table">
          <caption className="sr-only-focusable">Document requests, oldest first</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-sm text-neutral-500">
              <th scope="col" className="px-4 py-3 font-medium">
                Requester
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Document
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Waiting since
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Account
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.requestId} className="border-b border-neutral-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/staff/requests/${entry.requestId}`}
                    className="text-brand-700 font-medium underline"
                  >
                    {entry.requesterName ?? NAME_WITHHELD}
                  </Link>
                  {entry.sourceChannel === 'staff' ? (
                    <span className="block text-sm text-neutral-500">walk-in</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {entry.documentTypeName ?? 'Document no longer offered'}
                </td>
                <td className="px-4 py-3">
                  <RequestQueueChip state={entry.state} />
                </td>
                <td className="tabular px-4 py-3 text-neutral-700">{waitingSince(entry)}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {entry.hasAccount ? 'linked' : 'none'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="flex flex-col divide-y divide-neutral-100 sm:hidden">
          {entries.map((entry) => (
            <li key={entry.requestId} className="flex flex-col gap-1 p-4">
              <Link
                href={`/staff/requests/${entry.requestId}`}
                className="text-brand-700 font-medium underline"
              >
                {entry.requesterName ?? NAME_WITHHELD}
              </Link>
              <p className="text-sm text-neutral-700">
                {entry.documentTypeName ?? 'Document no longer offered'} · since{' '}
                {waitingSince(entry)} · {entry.hasAccount ? 'account linked' : 'no account'}
                {entry.sourceChannel === 'staff' ? ' · walk-in' : ''}
              </p>
              <RequestQueueChip state={entry.state} />
            </li>
          ))}
        </ul>
      </div>

      <nav
        aria-label="Queue pages"
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <p className="text-neutral-500">
          Page {page} of {pageCount} · {total} request{total === 1 ? '' : 's'}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 font-medium hover:bg-neutral-100"
            >
              Previous
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              href={pageHref(page + 1)}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 font-medium hover:bg-neutral-100"
            >
              Next
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  )
}
