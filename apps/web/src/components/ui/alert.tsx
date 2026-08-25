import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'
import { Icon, type IconName } from './icon'

/**
 * Inline messages (UI-A).
 *
 * Legacy announced results in a green toast at the bottom-right of the viewport.
 * That is not reproduced: a toast appears away from the control that caused it,
 * vanishes on a timer, and is easy to miss entirely at 200% zoom. v2 already
 * announces in place with `role="status"`, and this component gives that habit a
 * consistent shape.
 *
 * The left rule is the legacy alert's tell, kept. The icon is decorative — the
 * tone is carried by the heading and body text, so a `warning` still reads as a
 * warning in monochrome, in print, and to a screen reader.
 */

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<AlertTone, { surface: string; icon: IconName }> = {
  info: { surface: 'border-l-info-700 bg-info-100 text-info-700', icon: 'info' },
  success: {
    surface: 'border-l-success-700 bg-success-100 text-success-700',
    icon: 'check-circle',
  },
  warning: {
    surface: 'border-l-warning-700 bg-warning-100 text-warning-700',
    icon: 'alert-triangle',
  },
  danger: { surface: 'border-l-danger-700 bg-danger-100 text-danger-700', icon: 'alert-circle' },
}

export type AlertProps = {
  children: ReactNode
  tone?: AlertTone
  title?: ReactNode
  /**
   * How assistive technology should treat the message.
   *
   *   `status` — the result of something the user just did (default).
   *   `alert`  — interrupts; for a failure that blocks the current task.
   *   `none`   — static page content that was there before the user arrived,
   *              such as a standing notice. Announcing it on load would read
   *              the page's furniture aloud.
   */
  live?: 'status' | 'alert' | 'none'
  className?: string
}

export function Alert({ children, tone = 'info', title, live = 'status', className }: AlertProps) {
  const { surface, icon } = TONES[tone]

  return (
    <div
      {...(live === 'none' ? {} : { role: live })}
      className={cn(
        'rounded-control text-body-staff flex gap-3 border-l-4 px-4 py-3',
        surface,
        className,
      )}
    >
      <Icon name={icon} className="mt-0.5" />
      <div className="min-w-0">
        {title === undefined ? null : <p className="font-semibold">{title}</p>}
        <div className={cn(title === undefined ? undefined : 'mt-1')}>{children}</div>
      </div>
    </div>
  )
}
