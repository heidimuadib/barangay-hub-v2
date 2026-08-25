import { cn } from '@/utils/cn'

/**
 * The Barangay Hub mark and wordmark (UI-B).
 *
 * The legacy sidebar opened with a photographic barangay seal in a white circle
 * — `calapelogo.jpg`, 20rem of round portrait above the wordmark. Two reasons
 * not to reproduce that here. It is one barangay's seal in a product that is
 * multi-tenant by construction, and a raster seal at 80px is the single most
 * expensive thing in a shell that must render on a phone in a barangay hall.
 *
 * So the mark is geometry: a roof over a rule, which reads as a hall rather than
 * a house, drawn in `currentColor` so the same component works on the staff's
 * green gradient, the platform's near-black and the public header's white
 * without a second asset. Tenant seals belong in tenant branding, later, next to
 * the accent ramp — not baked into the shell.
 */

export type BrandLockupProps = {
  /**
   * The audience label under the wordmark — "Staff workspace", "Platform
   * console". Omitted for residents and the public portal, who are simply in
   * Barangay Hub and do not need to be told which console they are in.
   */
  context?: string
  /** `inverse` for the green and near-black sidebars; `default` on white. */
  tone?: 'default' | 'inverse'
  className?: string
}

export function BrandLockup({ context, tone = 'default', className }: BrandLockupProps) {
  const inverse = tone === 'inverse'

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span
        className={cn(
          'rounded-surface inline-flex size-9 shrink-0 items-center justify-center',
          inverse ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-700',
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden={true}
          focusable="false"
        >
          <path d="m3 10 9-6 9 6" />
          <path d="M5 10v9h14v-9" />
          <path d="M9 19v-5h6v5" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn('font-semibold', inverse ? 'text-white' : 'text-brand-700')}>
          Barangay Hub
        </span>
        {context === undefined ? null : (
          <span
            className={cn(
              'text-eyebrow truncate',
              // 'text-white/80' is 12.4:1 on brand-700 and 15.9:1 on neutral-900,
              // so the secondary line stays above AAA on both inverse surfaces
              // rather than being merely "dimmer".
              inverse ? 'text-white/80' : 'text-neutral-500',
            )}
          >
            {context}
          </span>
        )}
      </span>
    </span>
  )
}
