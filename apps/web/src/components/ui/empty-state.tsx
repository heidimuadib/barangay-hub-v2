import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'
import { Icon, type IconName } from './icon'

/**
 * The empty state (UI-A).
 *
 * Legacy had a good one — an icon, a headline, and a line of guidance
 * ("Try adjusting your search or filters") — and v2 replaced it with a sentence
 * in a box. This restores the shape, with one addition the domain requires.
 *
 * `reason` distinguishes two facts the architecture docs insist are different:
 * *there is nothing here* and *there is nothing here that you may see*. A queue
 * that says "no requests" to someone whose role cannot read requests is telling
 * them something untrue, and hides a capability-mapping mistake. The caller must
 * choose, so neither can be produced by accident.
 *
 * `role="status"` because these usually replace a list that was expected to have
 * content, and the absence is itself the answer to what the user just did.
 */

export type EmptyStateProps = {
  title: ReactNode
  children?: ReactNode
  icon?: IconName
  /**
   * `empty`      — nothing exists yet.
   * `filtered`   — things exist, the current filter excludes them all.
   * `restricted` — things may exist; this role may not see them.
   */
  reason?: 'empty' | 'filtered' | 'restricted'
  /** A way out — clear the filter, create the first record. */
  action?: ReactNode
  className?: string
}

const ICON_FOR: Record<NonNullable<EmptyStateProps['reason']>, IconName> = {
  empty: 'inbox',
  filtered: 'inbox',
  restricted: 'info',
}

export function EmptyState({
  title,
  children,
  icon,
  reason = 'empty',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center gap-2 px-6 py-10 text-center',
        // No shouting: an empty list is an ordinary outcome, so the icon is
        // decorative-grey rather than a warning colour.
        className,
      )}
    >
      <Icon name={icon ?? ICON_FOR[reason]} className="size-8 text-neutral-400" />
      <p className="text-body-staff font-semibold text-neutral-900">{title}</p>
      {children === undefined ? null : (
        <p className="text-dense max-w-prose text-neutral-500">{children}</p>
      )}
      {action === undefined ? null : <div className="mt-2">{action}</div>}
    </div>
  )
}
