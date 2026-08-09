import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

/**
 * The listing shell (UI-A).
 *
 * Two contracts meet here, and both are asserted by the e2e accessibility suite,
 * so this component exists mainly to make them impossible to forget on a new
 * listing:
 *
 *   1. A wide viewport gets a real table — a `caption` that names it, and
 *      `columnheader` cells rather than a grid of anonymous divs.
 *   2. A narrow viewport gets NO table at all. `assertRoster` explicitly fails
 *      if `getByRole('table')` matches below 640px, because a five- or
 *      nine-column staff queue is unreadable on a phone. The stacked list must
 *      carry every row and every link the table does.
 *
 * `Table` and `TableCardList` are therefore a pair: `sm:table`/`hidden` on one,
 * `sm:hidden` on the other. Rendering one without the other leaves a viewport
 * with nothing, which is why they are documented together rather than shipped
 * as one clever component that tries to guess.
 *
 * The visual treatment is the legacy dashboard's: a tinted uppercase header row,
 * hairline row separators, and a footer stating the count. The dense 15px type
 * scale is the one the staff queues already use.
 */

/** The bordered surface a listing sits in. Scrolls horizontally, never the page. */
export function TableFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-surface shadow-card overflow-x-auto border border-neutral-200 bg-white',
        className,
      )}
    >
      {children}
    </div>
  )
}

export type TableProps = {
  /**
   * Names the table for assistive technology, and is what
   * `getByRole('table', { name })` matches. Required — an unnamed listing in a
   * page with three of them is unnavigable.
   */
  caption: string
  children: ReactNode
  /** Show the caption to sighted readers too. Hidden by default. */
  captionVisible?: boolean
  /**
   * Hide below `sm`, where a `TableCardList` takes over. Turn off only for a
   * genuinely narrow table (two or three short columns) that reads fine on a
   * phone — and then do not render a card list beside it.
   */
  responsive?: boolean
  className?: string
}

export function Table({
  caption,
  children,
  captionVisible = false,
  responsive = true,
  className,
}: TableProps) {
  return (
    <table
      className={cn(
        'text-dense w-full text-left',
        responsive ? 'hidden sm:table' : 'table',
        className,
      )}
    >
      <caption
        className={cn(
          captionVisible
            ? 'text-eyebrow px-4 py-3 text-left text-neutral-500 uppercase'
            : 'sr-only',
        )}
      >
        {caption}
      </caption>
      {children}
    </table>
  )
}

export function THead({ children, className }: { children: ReactNode; className?: string }) {
  return <thead className={cn('bg-neutral-50', className)}>{children}</thead>
}

export function TBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn('border-b border-neutral-200 last:border-b-0', className)}>{children}</tr>
  )
}

/**
 * A column header. `scope="col"` is set here rather than left to the caller —
 * without it a screen reader cannot associate a cell with its column, and it is
 * the single easiest thing to omit.
 */
export function Th({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('text-eyebrow px-4 py-3 text-neutral-500 uppercase', className)}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 align-top text-neutral-700', className)} {...rest}>
      {children}
    </td>
  )
}

/**
 * The stacked form of a listing, shown only below `sm`. A real `ul`, so it is
 * announced as a list of N items — which is the parity the roster assertion
 * checks for when the table is absent.
 */
export function TableCardList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ul className={cn('flex flex-col divide-y divide-neutral-200 sm:hidden', className)}>
      {children}
    </ul>
  )
}

/**
 * The legacy listing footer: a count on the left, page controls on the right.
 *
 * The count is the part worth keeping — "Showing 20 of 143" answers "is this all
 * of it?", which bare Previous/Next buttons do not. Rendered as `text` and not
 * an aria-live region: it changes only as the result of a navigation, and the new
 * page announces itself.
 */
export function TableFooter({
  children,
  summary,
  className,
}: {
  summary: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-dense flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3',
        className,
      )}
    >
      <p className="text-neutral-500">{summary}</p>
      {children === undefined ? null : <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
