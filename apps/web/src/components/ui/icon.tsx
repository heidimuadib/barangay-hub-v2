import { cn } from '@/utils/cn'

/**
 * The icon set (UI-A / DEC-UI-01).
 *
 * Legacy loaded Font Awesome 6 from cdnjs on every page. That is impossible
 * here — `middleware.ts` sets `default-src 'self'` with a script nonce — and it
 * would be the wrong trade anyway: the whole product needs about a dozen glyphs.
 *
 * So this is a local set rather than an icon-library dependency. Ten paths at
 * 24×24 on a shared stroke weight is a few hundred bytes; an installed set
 * would ship a thousand icons and a build step to shake them out again. Add a
 * path here when a surface genuinely needs one — UI-B adds the navigation
 * glyphs when the shells that use them arrive.
 *
 * Accessibility: an icon is decorative BY DEFAULT. It gets `aria-hidden`, and
 * the text beside it carries the meaning. Pass `label` only when the icon is
 * the sole content of a control — then it becomes `role="img"` with an
 * accessible name. `tests/unit/components/ui/icon.test.tsx` pins both halves,
 * because a decorative icon that announces itself is as bad as a meaningful one
 * that stays silent.
 */

const ICON_PATHS = {
  'alert-circle': ['M12 8v4', 'M12 16h.01'],
  'alert-triangle': [
    'm10.29 3.86-8.4 14.55A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.71-2.59l-8.4-14.55a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  'check-circle': ['m8.5 12.5 2.5 2.5 5-5'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  info: ['M12 16v-4', 'M12 8h.01'],
  inbox: [
    'M22 12h-6l-2 3h-4l-2-3H2',
    'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  ],
  plus: ['M5 12h14', 'M12 5v14'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
} as const

/** Icons whose geometry also needs the enclosing circle. */
const CIRCLED = new Set(['alert-circle', 'check-circle', 'info'])

export type IconName = keyof typeof ICON_PATHS

export const ICON_NAMES = Object.keys(ICON_PATHS) as readonly IconName[]

export type IconProps = {
  name: IconName
  /**
   * Supply ONLY when the icon carries meaning no adjacent text repeats.
   * Omitting it is the common case and marks the icon decorative.
   */
  label?: string
  className?: string
}

export function Icon({ name, label, className }: IconProps) {
  const paths = ICON_PATHS[name]

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      // `shrink-0` because an icon in a flex row must never be squeezed into an
      // ellipse by a long label next to it.
      className={cn('size-5 shrink-0', className)}
      focusable="false"
      {...(label === undefined
        ? { 'aria-hidden': true }
        : { role: 'img' as const, 'aria-label': label })}
    >
      {CIRCLED.has(name) ? <circle cx={12} cy={12} r={10} /> : null}
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
