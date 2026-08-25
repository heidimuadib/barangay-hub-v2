'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Icon } from '@/components/ui'
import { cn } from '@/utils/cn'
import { isCurrent, type NavSection } from './nav'

/**
 * The navigation list (UI-B).
 *
 * One component for both the desktop sidebar and the mobile drawer. They are the
 * same links with the same current-state rule, and the legacy code proved what
 * happens when they are not: `sidebar.php` was included twice, once per
 * dashboard, and the resident copy drifted from the admin copy until they shared
 * only the stylesheet.
 *
 * ── Surfaces ──────────────────────────────────────────────────────────────
 *
 * `brand`  staff — white on the green gradient, the legacy identity
 * `light`  residents — brand ink on white, deliberately quieter
 * `dark`   platform — white on near-black, so a platform operator can never
 *          mistake the console for a barangay tenant
 *
 * ── Current state ─────────────────────────────────────────────────────────
 *
 * Legacy marked the active row with `rgba(255,255,255,.15)` and nothing else,
 * which is a colour-only distinction (WCAG 1.4.1) and invisible to assistive
 * technology. This keeps the wash — it is the recognisable legacy tell — and
 * adds two things it lacked: a solid left rule, and `aria-current="page"`, which
 * is what actually announces "you are here".
 */

export type SidebarTone = 'brand' | 'light' | 'dark'

type ToneStyles = {
  heading: string
  item: string
  itemActive: string
  rail: string
}

const TONES: Record<SidebarTone, ToneStyles> = {
  brand: {
    heading: 'text-white/60',
    item: 'text-white/90 hover:bg-white/10 hover:text-white',
    itemActive: 'bg-white/15 text-white font-semibold',
    rail: 'bg-white',
  },
  light: {
    heading: 'text-neutral-500',
    item: 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
    itemActive: 'bg-brand-50 text-brand-700 font-semibold',
    rail: 'bg-brand-700',
  },
  dark: {
    heading: 'text-neutral-400',
    item: 'text-neutral-200 hover:bg-white/10 hover:text-white',
    itemActive: 'bg-white/15 text-white font-semibold',
    rail: 'bg-white',
  },
}

export type SidebarNavProps = {
  sections: NavSection[]
  tone: SidebarTone
  /**
   * Called after a link is activated. The drawer passes its close function —
   * without it a mobile user taps a link and is left staring at the menu that
   * covers the page they just asked for.
   */
  onNavigate?: () => void
  className?: string
}

export function SidebarNav({ sections, tone, onNavigate, className }: SidebarNavProps) {
  const pathname = usePathname()
  const styles = TONES[tone]

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <h2 className={cn('text-eyebrow px-3 uppercase', styles.heading)}>{section.title}</h2>
          <ul aria-label={section.title} className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const current = isCurrent(item, pathname)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    {...(current ? { 'aria-current': 'page' as const } : {})}
                    {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
                    className={cn(
                      // `min-h-11` is the 44px floor the e2e suite measures. A
                      // nav row is the most-tapped control in the product and
                      // legacy shipped it at `p-2.5` — about 38px.
                      'rounded-control relative flex min-h-11 items-center gap-3 px-3 py-2',
                      'text-body-staff transition-colors',
                      styles.item,
                      current ? styles.itemActive : '',
                    )}
                  >
                    {current ? (
                      <span
                        aria-hidden={true}
                        className={cn(
                          'absolute inset-y-1.5 left-0 w-1 rounded-r-full',
                          styles.rail,
                        )}
                      />
                    ) : null}
                    <Icon name={item.icon} className="size-5" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
