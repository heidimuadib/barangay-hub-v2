import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

export type DetailItem = {
  label: ReactNode
  value: ReactNode
  id?: string
  className?: string
}

export type DetailListProps = {
  items: DetailItem[]
  columns?: 1 | 2 | 3
  layout?: 'stacked' | 'horizontal'
  divider?: boolean
  className?: string
}

/**
 * Accessible metadata and key-value pair list for profiles, documents,
 * requirements, and request reviews (UI-C).
 */
export function DetailList({
  items,
  columns = 1,
  layout = 'stacked',
  divider = false,
  className,
}: DetailListProps) {
  const gridCols =
    columns === 3
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      : columns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1'

  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4 text-sm',
        gridCols,
        divider && 'divide-y divide-neutral-200',
        className,
      )}
    >
      {items.map((item, idx) => {
        const isHorizontal = layout === 'horizontal'
        return (
          <div
            key={item.id ?? idx}
            className={cn(
              isHorizontal
                ? 'flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0'
                : 'flex flex-col gap-1 py-1',
              item.className,
            )}
          >
            <dt className="text-dense font-medium text-neutral-500">{item.label}</dt>
            <dd className="font-medium break-words text-neutral-900">{item.value}</dd>
          </div>
        )
      })}
    </dl>
  )
}
