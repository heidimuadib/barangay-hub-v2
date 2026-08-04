import type { PresentedTerms, TermStatus } from '@/features/documents'

import { PLACEHOLDER_BLOCKER, PLACEHOLDER_EXPLANATION, PLACEHOLDER_NOTICE } from '../constants'

/**
 * Fee, turnaround and validity — presented honestly (blocker B-08, RES-06).
 *
 * The values arrive already classified by `presentTerms`, computed on the
 * SERVER from the same rule the catalog and the request detail both use. This
 * component therefore cannot render an amount without its status: the two
 * travel in one object, which is the whole reason that object exists.
 *
 * Three distinct readings, never collapsed:
 *   • undecided  — nobody has set a figure. NOT rendered as ₱0.00.
 *   • provisional — a figure exists but no barangay has confirmed it (B-08).
 *   • confirmed  — settled. Unreachable while B-08 is open, and that is fine:
 *     the branch exists so confirming a schedule needs no code change.
 */

const TERM_LABELS = {
  fee: 'Fee',
  sla: 'Processing time',
  validity: 'Valid for',
} as const

export function DocumentTerms({ terms, headingId }: { terms: PresentedTerms; headingId?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <dl
        className="grid gap-3 sm:grid-cols-3"
        {...(headingId ? { 'aria-labelledby': headingId } : {})}
      >
        <TermItem label={TERM_LABELS.fee} value={terms.fee} status={terms.feeStatus} />
        <TermItem label={TERM_LABELS.sla} value={terms.sla} status={terms.slaStatus} />
        <TermItem
          label={TERM_LABELS.validity}
          value={terms.validity}
          status={terms.validityStatus}
        />
      </dl>

      {terms.showPlaceholderNotice ? <PlaceholderNotice /> : null}
    </div>
  )
}

function TermItem({
  label,
  value,
  status,
}: {
  label: string
  value: string | null
  status: TermStatus
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm font-medium text-neutral-500">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">
        {value === null ? (
          // A missing figure is stated as missing. Rendering a dash or a zero
          // here is exactly the misreading B-08 exists to prevent.
          <span className="text-neutral-700 italic">Not set by the barangay yet</span>
        ) : (
          <span className="font-medium text-neutral-900">{value}</span>
        )}
        {status === 'provisional' ? <PlaceholderChip /> : null}
      </dd>
    </div>
  )
}

/** The RES-06 chip. Rendered beside the value it qualifies, never apart. */
export function PlaceholderChip() {
  return (
    <span className="bg-warning-100 text-warning-700 inline-block rounded-full px-2 py-0.5 text-xs font-medium">
      {PLACEHOLDER_NOTICE}
    </span>
  )
}

export function PlaceholderNotice() {
  return (
    <p
      role="note"
      className="border-warning-100 rounded-md border bg-white px-3 py-2 text-sm text-neutral-700"
    >
      <span className="font-medium">{PLACEHOLDER_NOTICE}.</span> {PLACEHOLDER_EXPLANATION}{' '}
      <span className="text-neutral-500">(Reference {PLACEHOLDER_BLOCKER}.)</span>
    </p>
  )
}
