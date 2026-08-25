import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

/**
 * The card surface (UI-A).
 *
 * `rounded-lg border border-neutral-200 bg-white p-6` was written out in more
 * than twenty places across the app and feature directories. That string is now
 * here, at the legacy dashboard's own radius and shadow, so a change of surface
 * weight is one edit rather than twenty.
 *
 * Padding is a prop rather than fixed, because a card wrapping a table must not
 * pad it — the table's own cells provide the inset, and doubling it wastes the
 * horizontal space a nine-column staff queue needs.
 */

export type CardProps = {
  children: ReactNode
  /** `none` for cards whose child manages its own insets — tables, lists. */
  padding?: 'md' | 'none'
  /**
   * A left rule in the tenant accent. The legacy dashboard used `border-l-4` on
   * its statistic cards to group them at a glance; kept for the same purpose and
   * off by default, because a page where everything is accented has no accent.
   */
  accent?: boolean
  className?: string
}

export function Card({ children, padding = 'md', accent = false, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-surface shadow-card border border-neutral-200 bg-white',
        padding === 'md' && 'p-6',
        accent && 'border-l-brand-500 border-l-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * A card's title row: heading on the left, an action on the right.
 *
 * The heading level is required rather than defaulted. Exactly one `h1` per page
 * is asserted by the e2e suite on every route, so a component that quietly
 * picked its own level would be able to break that from inside a card.
 */
export type CardHeaderProps = {
  title: ReactNode
  as: 'h1' | 'h2' | 'h3'
  /** Wire to the section's `aria-labelledby` when the card is a landmark. */
  id?: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({
  title,
  as: Heading,
  id,
  description,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <Heading id={id} className="text-lg font-bold text-neutral-900">
          {title}
        </Heading>
        {description === undefined ? null : (
          <p className="text-dense mt-1 text-neutral-500">{description}</p>
        )}
      </div>
      {action === undefined ? null : (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-4', className)}>{children}</div>
}

/**
 * Actions at the foot of a card, on the legacy modal's tinted footer — the one
 * part of that pattern worth keeping. Right-aligned, so the confirming action
 * lands where the eye finishes.
 */
export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
