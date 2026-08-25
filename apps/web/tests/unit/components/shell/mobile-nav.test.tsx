import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MobileNav, type NavSection } from '@/components/shell'

/**
 * UI-B — the mobile drawer.
 *
 * Legacy's entire mobile implementation was one `classList.toggle`. Every
 * assertion below is something that line did not do, and each one is a way a
 * phone user gets stuck: no state announced, no keyboard exit, focus stranded on
 * `<body>`, and a menu still covering the page it just navigated to.
 */

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => '/staff') }))
vi.mock('next/navigation', () => ({ usePathname }))

const SECTIONS: NavSection[] = [
  {
    title: 'Residents',
    items: [
      { href: '/staff/registry', label: 'Registry', icon: 'id-card' },
      { href: '/staff/verification', label: 'Verification', icon: 'shield-check' },
    ],
  },
]

function renderDrawer() {
  return render(
    <MobileNav
      sections={SECTIONS}
      tone="brand"
      surfaceClassName="bg-brand-700"
      context="Staff workspace"
      footer={<button type="button">Sign out</button>}
    />,
  )
}

const trigger = () => screen.getByRole('button', { name: /open navigation menu/i })

beforeEach(() => {
  usePathname.mockReturnValue('/staff')
  document.body.style.overflow = ''
})

describe('MobileNav trigger', () => {
  it('reports collapsed state before it is opened', () => {
    renderDrawer()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('points at the panel it controls', async () => {
    const user = userEvent.setup()
    renderDrawer()

    const controls = trigger().getAttribute('aria-controls')
    expect(controls).toBeTruthy()

    await user.click(trigger())
    expect(screen.getByRole('dialog')).toHaveAttribute('id', controls)
  })

  it('meets the 44px touch-target floor', () => {
    renderDrawer()
    expect(trigger().className).toContain('size-11')
  })

  it('flips aria-expanded when open', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('MobileNav panel', () => {
  it('is not in the document until opened', () => {
    renderDrawer()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes the navigation and the account footer once open', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())

    expect(screen.getByRole('link', { name: 'Registry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('is a modal dialog with an accessible name', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())

    const dialog = screen.getByRole('dialog', { name: 'Navigation menu' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('moves focus into the panel on open', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())

    // Focus stays on the trigger otherwise, behind the scrim, and a screen
    // reader carries on reading the page underneath.
    await waitFor(() => {
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    })
  })

  it('locks body scroll while open and restores it on close', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.click(trigger())
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(document.body.style.overflow).not.toBe('hidden')
    })
  })
})

describe('MobileNav dismissal', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('returns focus to the trigger when it closes', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())
    await user.keyboard('{Escape}')

    // Without this, focus falls back to <body> and the next Tab restarts from
    // the top of the document.
    await waitFor(() => {
      expect(trigger()).toHaveFocus()
    })
  })

  it('closes via the labelled close control', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())

    await user.click(screen.getByRole('button', { name: /close navigation menu/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes after a navigation link is chosen', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())

    await user.click(screen.getByRole('link', { name: 'Registry' }))

    // Legacy left the drawer open over the page it had just navigated to.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes when the route changes underneath it', async () => {
    const user = userEvent.setup()
    const { rerender } = renderDrawer()
    await user.click(trigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    usePathname.mockReturnValue('/staff/registry')
    rerender(
      <MobileNav
        sections={SECTIONS}
        tone="brand"
        surfaceClassName="bg-brand-700"
        context="Staff workspace"
        footer={<button type="button">Sign out</button>}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

describe('MobileNav focus trap', () => {
  /**
   * Asserting the exact element rather than "focus is still somewhere inside".
   * The looser assertion passes even when the trap has degenerated to a single
   * element and focus never moved at all, which is precisely the bug these
   * tests exist to catch.
   */
  function edges() {
    const dialog = screen.getByRole('dialog')
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    )
    expect(focusable.length).toBeGreaterThan(2)
    return { first: focusable[0], last: focusable[focusable.length - 1] }
  }

  it('wraps from the last control back to the first', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())

    const { first, last } = edges()
    last?.focus()

    await user.tab()

    // The page behind the drawer is inert to the eye; it must be inert to the
    // keyboard too, or Tab walks out under the scrim.
    await waitFor(() => {
      expect(document.activeElement).toBe(first)
    })
  })

  it('wraps backwards from the first control to the last', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(trigger())

    const { first, last } = edges()
    first?.focus()

    await user.tab({ shift: true })

    await waitFor(() => {
      expect(document.activeElement).toBe(last)
    })
  })
})
