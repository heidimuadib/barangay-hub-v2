import type { ReactNode } from 'react'
import Link from 'next/link'

import { cn } from '@/utils/cn'
import { BrandLockup } from './brand-lockup'
import { MobileNav } from './mobile-nav'
import { SidebarNav, type SidebarTone } from './sidebar-nav'
import { compactSections, type NavSection } from './nav'

/**
 * The authenticated application shell (UI-B).
 *
 * Structure is the legacy dashboard's, because that part of it worked: a fixed
 * 16rem green sidebar, a sticky topbar, and content on a neutral canvas. What
 * changes is everything about how it is built.
 *
 * This is a SERVER component that renders two client islands — the nav list
 * (which needs `usePathname`) and the drawer (which needs state). Keeping the
 * shell itself on the server is the point: `children` is the page's own server
 * tree and stays server-rendered, rather than being handed across a client
 * boundary as a slot. The capability filtering that produced `sections` also
 * stays on the server, in the layout, where it belongs.
 *
 * The breakpoint is `lg` (1024px), not legacy's `md` (768px). A 16rem sidebar
 * plus a staff table at 768px leaves about 480px of canvas, which is where the
 * registry table starts scrolling sideways. Tablets get the drawer, and that is
 * a decision rather than an oversight.
 */

export type AppShellProps = {
  tone: SidebarTone
  sections: NavSection[]
  /** Where the brand lockup navigates — each audience's own home. */
  homeHref: string
  /** Audience label under the wordmark: "Staff workspace", "Platform console". */
  context?: string | undefined
  /** Account area — user identity and sign-out. Sidebar foot and drawer foot. */
  account?: ReactNode | undefined
  /** Topbar right-hand slot: the barangay switcher on staff. */
  topbarEnd?: ReactNode | undefined
  /**
   * Desktop-only working-context line — "Working in San Isidro". The flat
   * header this shell replaced carried it, and the sidebar cannot: the account
   * block at its foot is below the fold on a short laptop screen.
   */
  topbarLabel?: ReactNode | undefined
  /**
   * Full-width strip directly under the topbar. The platform console uses it to
   * say, permanently and in words, that it is not a barangay tenant context.
   */
  banner?: ReactNode | undefined
  contentWidth?: 'wide' | 'narrow' | undefined
  children: ReactNode
}

const SURFACES: Record<SidebarTone, string> = {
  // 700 → 800, never from the legacy 500: legacy put white nav labels on
  // #319366 at 3.82:1. Same hue family, legible stops (DEC-UI-01).
  brand: 'bg-gradient-to-b from-brand-700 to-brand-800 text-white',
  light: 'bg-white border-r border-neutral-200',
  dark: 'bg-neutral-900 text-white',
}

const CONTENT_WIDTHS = {
  wide: 'max-w-[1440px]',
  narrow: 'max-w-[900px]',
} as const

export function AppShell({
  tone,
  sections,
  homeHref,
  context,
  account,
  topbarEnd,
  topbarLabel,
  banner,
  contentWidth = 'wide',
  children,
}: AppShellProps) {
  const visible = compactSections(sections)
  const surface = SURFACES[tone]

  /**
   * Everything else in the topbar — the drawer trigger and the brand — is
   * `lg:hidden`, because on desktop the sidebar carries both. So a shell with
   * neither a label nor an end slot has a topbar that is empty above 1024px,
   * and an empty 44px white strip above the content reads as a rendering fault.
   * Residents and the platform console are exactly that case; the bar collapses
   * for them rather than being reserved for nothing.
   */
  const hasDesktopTopbar = topbarEnd !== undefined || topbarLabel !== undefined

  return (
    <div className="min-h-dvh bg-neutral-50">
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto lg:flex',
          surface,
        )}
      >
        <div className="px-4 py-5">
          {/* `min-h-11`: the lockup's own content measures 43px, and the brand
              is a link to the audience's home — a real navigation target held to
              the same 44px floor as every other one. */}
          <Link
            href={homeHref}
            className="rounded-control inline-flex min-h-11 items-center focus-visible:outline-offset-4"
          >
            <BrandLockup
              tone={tone === 'light' ? 'default' : 'inverse'}
              {...(context === undefined ? {} : { context })}
            />
          </Link>
        </div>

        <nav aria-label="Main" className="flex-1 px-3 pb-4">
          <SidebarNav sections={visible} tone={tone} />
        </nav>

        {account === undefined ? null : (
          <div
            className={cn(
              'border-t px-4 py-4',
              tone === 'light' ? 'border-neutral-200' : 'border-white/15',
            )}
          >
            {account}
          </div>
        )}
      </aside>

      {/* ── Content column ──────────────────────────────────────────────── */}
      <div className="lg:pl-64">
        <header
          className={cn(
            'sticky top-0 z-20 border-b border-neutral-200 bg-white',
            hasDesktopTopbar ? '' : 'lg:hidden',
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <MobileNav
                sections={visible}
                tone={tone}
                surfaceClassName={surface}
                {...(context === undefined ? {} : { context })}
                {...(account === undefined ? {} : { footer: account })}
              />
              {/* The brand is in the sidebar on desktop; on mobile the sidebar
                  is gone, so the topbar carries it. */}
              <Link
                href={homeHref}
                className="rounded-control inline-flex min-h-11 min-w-0 items-center lg:hidden"
              >
                <BrandLockup {...(context === undefined ? {} : { context })} />
              </Link>
              {topbarLabel === undefined ? null : (
                <p className="text-dense hidden min-w-0 truncate text-neutral-500 lg:block">
                  {topbarLabel}
                </p>
              )}
            </div>
            {topbarEnd === undefined ? null : (
              <div className="flex min-h-11 flex-wrap items-center justify-end gap-3">
                {topbarEnd}
              </div>
            )}
          </div>
        </header>

        {banner}

        <main
          id="main"
          className={cn('mx-auto w-full px-4 py-6 sm:px-6', CONTENT_WIDTHS[contentWidth])}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
