import { cn } from '@/utils/cn'

/**
 * Loading states (UI-A).
 *
 * The six `loading.tsx` files were one-line sentences. That is not wrong — a
 * visible, announced "Loading…" beats a silent spinner — but it gives no sense of
 * what is arriving, so a slow queue looks like a broken page.
 *
 * Two pieces, and the choice between them is about what is known: `LoadingState`
 * when only the fact of loading is known, `SkeletonRows` when the SHAPE is known
 * because a table is coming.
 *
 * The label is always real text inside `role="status"`. The spinner is decorative
 * and `aria-hidden`; under `prefers-reduced-motion` the global rule in
 * `globals.css` stops it turning, which is why the text has to carry the meaning
 * on its own.
 */

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-center gap-3 px-6 py-10 text-neutral-500',
        className,
      )}
    >
      <span
        aria-hidden
        className="border-t-brand-700 size-5 shrink-0 animate-spin rounded-full border-2 border-neutral-200"
      />
      <span className="text-body-staff">{label}</span>
    </div>
  )
}

/**
 * Placeholder rows matching the listing that is about to replace them.
 *
 * `aria-hidden` on the bars and a single `role="status"` on the wrapper: without
 * that, a screen reader announces eight empty rows. The visible label is kept so
 * the state is not conveyed by shimmer alone.
 */
export function SkeletonRows({
  rows = 5,
  label = 'Loading…',
  className,
}: {
  rows?: number
  label?: string
  className?: string
}) {
  return (
    <div role="status" className={cn('flex flex-col gap-3 p-4', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className="rounded-control h-11 w-full animate-pulse bg-neutral-100"
        />
      ))}
    </div>
  )
}
