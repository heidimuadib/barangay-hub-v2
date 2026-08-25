'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { Icon } from '@/components/ui'
import { cn } from '@/utils/cn'
import { BrandLockup } from './brand-lockup'
import { SidebarNav, type SidebarTone } from './sidebar-nav'
import type { NavSection } from './nav'

/**
 * The mobile navigation drawer (UI-B).
 *
 * Legacy's mobile story was `sidebar.classList.toggle('-translate-x-full')` and
 * nothing else: the 16rem sidebar slid over the page with no overlay, no focus
 * handling, no Escape, no `aria-expanded`, and it stayed open after you tapped a
 * link — so a phone user navigated and then had to find the hamburger again to
 * see where they had arrived. The drawer is the right pattern; that
 * implementation of it was three lines short of usable.
 *
 * What this adds, and why each one is not optional:
 *
 * - `aria-expanded` / `aria-controls` on the trigger — otherwise the control
 *   announces as an unlabelled button with no state.
 * - Escape closes. A drawer that covers the page and traps focus with no
 *   keyboard exit is a trap in the literal sense.
 * - Focus moves into the panel on open and RETURNS TO THE TRIGGER on close.
 *   Without the return, focus falls back to `<body>` and the next Tab restarts
 *   from the top of the document.
 * - Tab cycles inside the panel while it is open, because the page behind it is
 *   inert to the eye and should be inert to the keyboard too.
 * - Body scroll is locked, or the page behind scrolls under the drawer on iOS.
 * - It closes on navigation — both via `onNavigate` and on `pathname` change, so
 *   a link that resolves to the current route still closes it.
 */

export type MobileNavProps = {
  sections: NavSection[]
  tone: SidebarTone
  /** Panel surface classes — kept identical to the desktop sidebar's. */
  surfaceClassName: string
  context?: string | undefined
  /** Account area, rendered at the foot of the panel. */
  footer?: ReactNode | undefined
}

/**
 * Focusable descendants, in DOM order, for the trap and the initial focus.
 *
 * No visibility filtering. The panel only exists while it is open and nothing
 * inside it is conditionally hidden, so an `offsetParent !== null` guard would
 * screen out nothing real — and it silently breaks wherever layout is not
 * computed, returning an empty list that leaves initial focus unset and reduces
 * the trap to a single element.
 */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

export function MobileNav({ sections, tone, surfaceClassName, context, footer }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  // Close on navigation. `onNavigate` covers the ordinary tap; this covers the
  // case where the router resolves to a route the drawer did not initiate.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) {
      return
    }

    const panel = panelRef.current
    // Captured here rather than read in the cleanup: the trigger is rendered
    // unconditionally and never remounts, so the two are the same node — but
    // reading a ref during cleanup is the pattern that breaks when that stops
    // being true, and `react-hooks/exhaustive-deps` is right to say so.
    const triggerAtOpen = triggerRef.current

    // Initial focus: the panel's own close button, which is its first control.
    // Focusing the container instead would announce the whole drawer at once.
    const initial = panel === null ? [] : focusablesIn(panel)
    initial[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key !== 'Tab' || panel === null) {
        return
      }

      const focusable = focusablesIn(panel)
      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) {
        return
      }

      // Wrap in both directions. `document.activeElement` rather than
      // `event.target` so focus that has escaped the panel is pulled back.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      /**
       * Return focus to the trigger, unconditionally.
       *
       * The obvious-looking guard — restore only if focus is still inside the
       * panel — cannot work here: React unmounts the panel before running this
       * cleanup, so by now the panel is detached and `document.activeElement`
       * has already fallen back to `<body>`. The check would be false every
       * time and focus would be silently lost on every close.
       *
       * Unconditional is also simply correct: focus is trapped inside the panel
       * for as long as it is open, so there is no case where the user has moved
       * on somewhere else and would resent being pulled back.
       */
      triggerAtOpen?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((value) => !value)
        }}
        aria-expanded={open}
        aria-controls={panelId}
        // The 44px floor, and `lg:hidden` because the desktop sidebar is
        // permanent — a trigger for an always-visible sidebar is noise.
        className={cn(
          'rounded-control inline-flex size-11 items-center justify-center lg:hidden',
          'text-neutral-700 transition-colors hover:bg-neutral-100',
        )}
      >
        <Icon name="menu" label="Open navigation menu" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/*
            The scrim closes on tap, which is the expected gesture. It is not a
            button and carries no accessible name: Escape and the labelled close
            control are the accessible exits, and a second announced "close" over
            the whole viewport only adds noise to a screen reader's tab order.
          */}
          <div className="absolute inset-0 bg-neutral-900/50" aria-hidden={true} onClick={close} />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal={true}
            aria-label="Navigation menu"
            className={cn(
              // `max-w-[85vw]` so the scrim is always visibly present — a
              // full-bleed panel reads as a new page rather than a layer over
              // this one, and there is nowhere obvious to tap to dismiss.
              'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto',
              surfaceClassName,
            )}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <BrandLockup
                tone={tone === 'light' ? 'default' : 'inverse'}
                {...(context === undefined ? {} : { context })}
              />
              <button
                type="button"
                onClick={close}
                className={cn(
                  'rounded-control inline-flex size-11 shrink-0 items-center justify-center',
                  'transition-colors',
                  tone === 'light'
                    ? 'text-neutral-700 hover:bg-neutral-100'
                    : 'text-white hover:bg-white/10',
                )}
              >
                <Icon name="x" label="Close navigation menu" />
              </button>
            </div>

            <nav aria-label="Main" className="flex-1 px-3 pb-4">
              <SidebarNav sections={sections} tone={tone} onNavigate={close} />
            </nav>

            {footer === undefined ? null : (
              <div
                className={cn(
                  'border-t px-4 py-4',
                  tone === 'light' ? 'border-neutral-200' : 'border-white/15',
                )}
              >
                {footer}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
