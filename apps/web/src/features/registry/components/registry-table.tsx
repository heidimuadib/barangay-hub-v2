import Link from 'next/link'

import { RESIDENCY_BASES } from '../constants'
import type { RegistryEntry } from '../types/registry'

/**
 * Responsive registry listing: a real table from `sm` upwards, stacked cards
 * below it. Both render the same rows from the same markup source, so a
 * narrow screen never loses information.
 */

function StateChip({ entry }: { entry: RegistryEntry }) {
  if (entry.superseded) {
    return (
      <span className="inline-block rounded-full bg-neutral-200 px-2 py-0.5 text-sm text-neutral-700">
        superseded
      </span>
    )
  }
  if (entry.verificationState === null) {
    return <span className="text-sm text-neutral-500">no application</span>
  }
  const tone =
    entry.verificationState === 'approved'
      ? 'bg-success-100 text-success-700'
      : entry.verificationState === 'rejected'
        ? 'bg-danger-100 text-danger-700'
        : entry.verificationState === 'info_requested'
          ? 'bg-warning-100 text-warning-700'
          : 'bg-info-100 text-info-700'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-sm ${tone}`}>
      {entry.verificationState}
    </span>
  )
}

export function RegistryRows({ entries }: { entries: readonly RegistryEntry[] }) {
  return (
    <>
      {/* Table for pointer/wide layouts. */}
      <table className="text-dense hidden w-full text-left sm:table">
        <caption className="sr-only-focusable">Residents in this barangay</caption>
        <thead>
          <tr className="border-b border-neutral-200 text-sm text-neutral-500">
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Residency
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Account
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Verification
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.personId} className="border-b border-neutral-100">
              <td className="px-4 py-3">
                <Link
                  href={`/staff/registry/${entry.personId}`}
                  className="text-brand-700 font-medium underline"
                >
                  {entry.fullName}
                </Link>
                {entry.sourceChannel === 'staff' ? (
                  <span className="block text-sm text-neutral-500">walk-in</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-neutral-700">
                {RESIDENCY_BASES[entry.residencyBasisKey].label}
              </td>
              <td className="px-4 py-3 text-neutral-700">{entry.hasAccount ? 'linked' : 'none'}</td>
              <td className="px-4 py-3">
                <StateChip entry={entry} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cards below `sm`, where a four-column table would be unreadable. */}
      <ul className="flex flex-col divide-y divide-neutral-100 sm:hidden">
        {entries.map((entry) => (
          <li key={entry.personId} className="flex flex-col gap-1 p-4">
            <Link
              href={`/staff/registry/${entry.personId}`}
              className="text-brand-700 font-medium underline"
            >
              {entry.fullName}
            </Link>
            <p className="text-sm text-neutral-700">
              {RESIDENCY_BASES[entry.residencyBasisKey].label} ·{' '}
              {entry.hasAccount ? 'account linked' : 'no account'}
              {entry.sourceChannel === 'staff' ? ' · walk-in' : ''}
            </p>
            <StateChip entry={entry} />
          </li>
        ))}
      </ul>
    </>
  )
}

export function RegistryTable({
  entries,
  page,
  pageCount,
  total,
}: {
  entries: readonly RegistryEntry[]
  page: number
  pageCount: number
  total: number
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700">
        No residents are registered in this barangay yet. Use “Add a walk-in resident” to record
        someone who registers at the counter.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <RegistryRows entries={entries} />
      </div>

      <nav
        aria-label="Registry pages"
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <p className="text-neutral-500">
          Page {page} of {pageCount} · {total} resident{total === 1 ? '' : 's'}
        </p>
        <div className="flex gap-2">
          {/* Only the page NUMBER travels in the URL — never a name or any
              other personal value (P6-C-E). */}
          {page > 1 ? (
            <Link
              href={`/staff/registry?page=${page - 1}`}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 font-medium hover:bg-neutral-100"
            >
              Previous
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              href={`/staff/registry?page=${page + 1}`}
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
