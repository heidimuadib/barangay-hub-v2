import Link from 'next/link'

import type { VerificationQueueEntry, VerificationState } from '../types/registry'

/**
 * Staff verification queue (Slice 2D). Responsive like the registry table:
 * a real table from `sm` upwards, stacked cards below it.
 *
 * URL discipline: the ONLY parameters this surface produces are `state`
 * (a key from the fixed vocabulary) and `page` (a number). A resident's name
 * appears in link TEXT, never in a link TARGET (P6-C-E).
 */

/** Staff-facing state labels: factual, not the resident-facing reassurance copy. */
const STAFF_STATE_LABELS: Record<VerificationState, { label: string; tone: string }> = {
  draft: { label: 'draft', tone: 'bg-neutral-100 text-neutral-700' },
  submitted: { label: 'submitted', tone: 'bg-info-100 text-info-700' },
  in_review: { label: 'in review', tone: 'bg-info-100 text-info-700' },
  info_requested: { label: 'info requested', tone: 'bg-warning-100 text-warning-700' },
  resubmitted: { label: 'resubmitted', tone: 'bg-info-100 text-info-700' },
  approved: { label: 'approved', tone: 'bg-success-100 text-success-700' },
  rejected: { label: 'rejected', tone: 'bg-danger-100 text-danger-700' },
}

export function QueueStateChip({ state }: { state: VerificationState }) {
  const copy = STAFF_STATE_LABELS[state]
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-sm ${copy.tone}`}>
      {copy.label}
    </span>
  )
}

/** Filter chips. "Needs action" is the parameter-less default view. */
const FILTERS: readonly { key: VerificationState | null; label: string }[] = [
  { key: null, label: 'Needs action' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'in_review', label: 'In review' },
  { key: 'info_requested', label: 'Info requested' },
  { key: 'resubmitted', label: 'Resubmitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export function QueueFilters({ active }: { active: VerificationState | null }) {
  return (
    <nav aria-label="Filter by state" className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = filter.key === active
        return (
          <Link
            key={filter.label}
            href={
              filter.key === null
                ? '/staff/verification'
                : `/staff/verification?state=${filter.key}`
            }
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

function waitingSince(entry: VerificationQueueEntry): string {
  const raw = entry.submittedAt ?? entry.createdAt
  return raw.slice(0, 10)
}

export function VerificationQueue({
  entries,
  page,
  pageCount,
  total,
  stateFilter,
}: {
  entries: readonly VerificationQueueEntry[]
  page: number
  pageCount: number
  total: number
  stateFilter: VerificationState | null
}) {
  if (entries.length === 0) {
    return (
      <p
        role="status"
        className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700"
      >
        {stateFilter === null
          ? 'Nothing needs action right now. Applications appear here as residents submit them.'
          : `No application is currently ${STAFF_STATE_LABELS[stateFilter].label}.`}
      </p>
    )
  }

  const pageHref = (target: number) =>
    stateFilter === null
      ? `/staff/verification?page=${target}`
      : `/staff/verification?state=${stateFilter}&page=${target}`

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        {/* Table for pointer/wide layouts. */}
        <table className="text-dense hidden w-full text-left sm:table">
          <caption className="sr-only-focusable">Verification applications, oldest first</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-sm text-neutral-500">
              <th scope="col" className="px-4 py-3 font-medium">
                Applicant
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
              <tr key={entry.applicationId} className="border-b border-neutral-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/staff/verification/${entry.applicationId}`}
                    className="text-brand-700 font-medium underline"
                  >
                    {entry.fullName}
                  </Link>
                  {entry.sourceChannel === 'staff' ? (
                    <span className="block text-sm text-neutral-500">walk-in</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <QueueStateChip state={entry.state} />
                </td>
                <td className="tabular px-4 py-3 text-neutral-700">{waitingSince(entry)}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {entry.hasAccount ? 'linked' : 'none'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Cards below `sm`. */}
        <ul className="flex flex-col divide-y divide-neutral-100 sm:hidden">
          {entries.map((entry) => (
            <li key={entry.applicationId} className="flex flex-col gap-1 p-4">
              <Link
                href={`/staff/verification/${entry.applicationId}`}
                className="text-brand-700 font-medium underline"
              >
                {entry.fullName}
              </Link>
              <p className="text-sm text-neutral-700">
                since {waitingSince(entry)} · {entry.hasAccount ? 'account linked' : 'no account'}
                {entry.sourceChannel === 'staff' ? ' · walk-in' : ''}
              </p>
              <QueueStateChip state={entry.state} />
            </li>
          ))}
        </ul>
      </div>

      <nav
        aria-label="Queue pages"
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <p className="text-neutral-500">
          Page {page} of {pageCount} · {total} application{total === 1 ? '' : 's'}
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
