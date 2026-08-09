import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

/**
 * Status badges (UI-A).
 *
 * Every feature that shows state declared its own version of this pill —
 * `RequestStateChip`, `RequestQueueChip`, `VerificationStatusBadge` — each with
 * the same `rounded-full px-2 py-0.5` and its own copy of the tone map. The
 * shape lives here now; the vocabulary stays with the feature that owns the
 * state machine, because "what does `ready_for_issue` mean to staff" is a domain
 * question and not a presentational one.
 *
 * The tones deliberately do NOT include the brand accent. A tenant may recolour
 * its brand; if a status borrowed that colour, a barangay could make its
 * "rejected" chip green (Phase 2 §8.1). Status tones come from the locked
 * semantic scale only.
 *
 * Every tone is `-700` text on its `-100` tint, which the palette test measures
 * as a pair — the combination that actually ships, rather than each colour
 * against a white it is never used on.
 */

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  info: 'bg-info-100 text-info-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
}

export type BadgeProps = {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}

/**
 * The label is always rendered as text. Colour is a second signal, never the
 * only one — asserted for the request and verification states in the e2e suite,
 * and the reason this component has no icon-only mode.
 */
export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'text-dense inline-flex items-center rounded-full px-2.5 py-0.5 font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
