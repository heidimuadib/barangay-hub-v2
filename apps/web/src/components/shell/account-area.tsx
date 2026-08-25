import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'
import { Icon } from '@/components/ui'

/**
 * The signed-in identity block at the foot of a shell (UI-B).
 *
 * Legacy printed the full name AND the email address into the sidebar of every
 * page. That is not reproduced. Staff terminals in a barangay hall sit on a
 * public counter, and an email address on permanent display is a piece of
 * personal data shown to everyone in the queue for no operational benefit — the
 * name already answers "who is signed in". The secondary line here carries the
 * working context instead: which barangay, in which role.
 *
 * Presentational and server-safe. The sign-out control is passed in as
 * `children` because it is a Server Action form the identity feature owns.
 */

export type AccountAreaProps = {
  name: string
  /** Working context — "San Isidro · Clerk" — not contact details. */
  secondary?: string | undefined
  tone: 'inverse' | 'default'
  children?: ReactNode
}

export function AccountArea({ name, secondary, tone, children }: AccountAreaProps) {
  const inverse = tone === 'inverse'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
            inverse ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-700',
          )}
        >
          <Icon name="user" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span
            className={cn(
              'text-dense truncate font-medium',
              inverse ? 'text-white' : 'text-neutral-900',
            )}
          >
            {name}
          </span>
          {secondary === undefined ? null : (
            <span
              className={cn(
                'text-eyebrow truncate',
                inverse ? 'text-white/80' : 'text-neutral-500',
              )}
            >
              {secondary}
            </span>
          )}
        </span>
      </div>
      {children}
    </div>
  )
}
