import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'
import { Icon } from './icon'

/**
 * Page and section headings (UI-A).
 *
 * Neither the legacy dashboards nor v2 had breadcrumbs, and both lose the reader
 * on a detail route: `/staff/requests/[id]` currently opens on a heading with no
 * indication of what it belongs to or how to get back. The trail is built from a
 * caller-supplied list of static route labels — never from record data, because
 * a resident's name in a breadcrumb is a resident's name in something that gets
 * screenshotted and pasted (P6-C-E).
 *
 * `PageHeader` renders the page's only `h1`. The e2e suite asserts exactly one
 * per route, so this component must be used once per page and never nested.
 */

export type Crumb = {
  label: string
  /** Omit on the final crumb — the page you are already on is not a link. */
  href?: string
}

export function Breadcrumbs({ trail, className }: { trail: readonly Crumb[]; className?: string }) {
  if (trail.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="text-dense flex flex-wrap items-center gap-1 text-neutral-500">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <Icon name="chevron-right" className="size-4 text-neutral-400" /> : null}
              {crumb.href === undefined || isLast ? (
                // The current page is marked for assistive technology rather
                // than merely styled differently.
                <span {...(isLast ? { 'aria-current': 'page' as const } : {})}>{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="text-brand-700 hover:underline">
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** The page's primary action, right-aligned on wide viewports. */
  action?: ReactNode
  breadcrumbs?: readonly Crumb[]
  /** Status of the record this page is about — a badge, usually. */
  meta?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {breadcrumbs === undefined ? null : <Breadcrumbs trail={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
            {meta}
          </div>
          {description === undefined ? null : (
            <p className="mt-2 max-w-prose text-neutral-700">{description}</p>
          )}
        </div>
        {action === undefined ? null : (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
        )}
      </div>
    </div>
  )
}

/**
 * The legacy dashboard's uppercase group label ("MAIN MENU"), which it wrote out
 * as `text-xs uppercase tracking-wider` on every occurrence. One token, one
 * component — and a real heading element, so the grouping is in the outline and
 * not only in the pixels.
 */
export function SectionHeader({
  title,
  as: Heading = 'h2',
  action,
  className,
}: {
  title: ReactNode
  as?: 'h2' | 'h3'
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
      <Heading className="text-eyebrow text-neutral-500 uppercase">{title}</Heading>
      {action}
    </div>
  )
}
