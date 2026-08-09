import { cn } from '@/utils/cn'

/**
 * The icon set (UI-A / DEC-UI-01).
 *
 * Legacy loaded Font Awesome 6 from cdnjs on every page. That is impossible
 * here — `middleware.ts` sets `default-src 'self'` with a script nonce — and it
 * would be the wrong trade anyway: the whole product needs about a dozen glyphs.
 *
 * So this is a local set rather than an icon-library dependency. Twenty paths at
 * 24×24 on a shared stroke weight is a couple of kilobytes; an installed set
 * would ship a thousand icons and a build step to shake them out again. Add a
 * path here when a surface genuinely needs one — UI-B added the ten navigation
 * glyphs its shells use, and nothing beyond them.
 *
 * Circles are written as arc paths rather than `<circle>` elements. The only
 * exception is the status trio below, whose ring is concentric at 12/12; a
 * person's head at 12/7 or an avatar at 9/10 cannot use that shortcut, so those
 * shapes carry their own arcs.
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
  building: [
    'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
    'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
    'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
    'M10 6h4',
    'M10 10h4',
    'M10 14h4',
    'M10 18h4',
  ],
  'check-circle': ['m8.5 12.5 2.5 2.5 5-5'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  'file-text': [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  home: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  'id-card': [
    'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M11 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    'M13 16a4 4 0 0 0-8 0',
    'M14 9h4',
    'M14 13h4',
  ],
  inbox: [
    'M22 12h-6l-2 3h-4l-2-3H2',
    'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  ],
  info: ['M12 16v-4', 'M12 8h.01'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  plus: ['M5 12h14', 'M12 5v14'],
  'scroll-text': [
    'M19 17V5a2 2 0 0 0-2-2H4',
    'M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 0 1 2-2',
    'M15 8h-5',
    'M15 12h-5',
  ],
  'shield-check': [
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    'm9 12 2 2 4-4',
  ],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
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
