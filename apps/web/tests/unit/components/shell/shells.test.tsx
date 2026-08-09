import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AccountArea,
  AppShell,
  BrandLockup,
  PublicShell,
  type NavSection,
} from '@/components/shell'

/**
 * UI-B — the four shells' structural contracts.
 *
 * Structure, landmarks and the properties each audience depends on. Not visual
 * design: that is checked by eye and by the Playwright accessibility suite.
 */

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => '/staff') }))
vi.mock('next/navigation', () => ({ usePathname }))

const SECTIONS: NavSection[] = [
  {
    title: 'Residents',
    items: [{ href: '/staff/registry', label: 'Registry', icon: 'id-card' }],
  },
  { title: 'Administration', items: [] },
]

beforeEach(() => {
  usePathname.mockReturnValue('/staff')
})

describe('AppShell', () => {
  it('puts the skip link first, before any navigation', () => {
    render(
      <AppShell tone="brand" sections={SECTIONS} homeHref="/staff">
        <p>content</p>
      </AppShell>,
    )

    // Phase 5 §33: it must be the first focusable element on every page.
    const skip = screen.getByRole('link', { name: /skip to main content/i })
    expect(skip).toBeInTheDocument()
    expect(skip.compareDocumentPosition(screen.getByRole('navigation', { name: 'Main' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('renders the page content inside the main landmark the skip link targets', () => {
    render(
      <AppShell tone="brand" sections={SECTIONS} homeHref="/staff">
        <p>content</p>
      </AppShell>,
    )

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main')
    expect(within(main).getByText('content')).toBeInTheDocument()
  })

  it('drops a section whose items were all filtered away by capability', () => {
    render(
      <AppShell tone="brand" sections={SECTIONS} homeHref="/staff">
        <p>content</p>
      </AppShell>,
    )

    // A heading with nothing under it tells a clerk they are missing something.
    expect(screen.queryByText('Administration')).not.toBeInTheDocument()
    expect(screen.getAllByText('Residents').length).toBeGreaterThan(0)
  })

  it('renders the account area and the topbar slots it is given', () => {
    render(
      <AppShell
        tone="brand"
        sections={SECTIONS}
        homeHref="/staff"
        account={<AccountArea name="Ana Reyes" secondary="Barangay administrator" tone="inverse" />}
        topbarLabel="Working in San Isidro"
        topbarEnd={<button type="button">Switch</button>}
      >
        <p>content</p>
      </AppShell>,
    )

    expect(screen.getAllByText('Ana Reyes').length).toBeGreaterThan(0)
    expect(screen.getByText('Working in San Isidro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch' })).toBeInTheDocument()
  })

  it('renders a banner when one is supplied', () => {
    render(
      <AppShell
        tone="dark"
        sections={SECTIONS}
        homeHref="/platform"
        banner={<p>Platform console — tenant administration only.</p>}
      >
        <p>content</p>
      </AppShell>,
    )

    expect(screen.getByText(/tenant administration only/i)).toBeInTheDocument()
  })

  it('holds the brand link to the 44px floor like any other navigation target', () => {
    // It measured 43px and the e2e accessibility suite caught it. The lockup's
    // own content does not reach the floor on its own, so the link sets it.
    render(
      <AppShell tone="brand" sections={SECTIONS} homeHref="/staff" context="Staff workspace">
        <p>content</p>
      </AppShell>,
    )

    for (const link of screen.getAllByRole('link', { name: /barangay hub/i })) {
      expect(link.className).toContain('min-h-11')
    }
  })

  it('offers exactly one drawer trigger, not one per rendered nav', () => {
    // The nav list is rendered twice — sidebar and drawer — and an extra
    // trigger would mean two menus fighting over the same state.
    render(
      <AppShell tone="light" sections={SECTIONS} homeHref="/dashboard">
        <p>content</p>
      </AppShell>,
    )

    expect(screen.getAllByRole('button', { name: /open navigation menu/i })).toHaveLength(1)
  })
})

describe('PublicShell', () => {
  it('provides the brand, a sign-in entry point and a footer', () => {
    render(
      <PublicShell>
        <h1>Barangay documents</h1>
      </PublicShell>,
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThan(0)
  })

  it('carries the skip link and a main landmark like every other shell', () => {
    render(
      <PublicShell>
        <h1>Barangay documents</h1>
      </PublicShell>,
    )

    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('shows no application navigation — the portal is not the console', () => {
    render(
      <PublicShell>
        <h1>Barangay documents</h1>
      </PublicShell>,
    )

    // No drawer, no sidebar, no staff modules. Someone who has never signed in
    // should not be met with an admin console.
    expect(screen.queryByRole('button', { name: /open navigation menu/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })
})

describe('BrandLockup', () => {
  it('names the product and its audience context', () => {
    render(<BrandLockup context="Platform console" />)

    expect(screen.getByText('Barangay Hub')).toBeInTheDocument()
    expect(screen.getByText('Platform console')).toBeInTheDocument()
  })

  it('keeps the mark decorative — the wordmark beside it carries the name', () => {
    const { container } = render(<BrandLockup />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('AccountArea', () => {
  it('shows who is signed in and their working context', () => {
    render(<AccountArea name="Ana Reyes" secondary="Barangay administrator" tone="inverse" />)

    expect(screen.getByText('Ana Reyes')).toBeInTheDocument()
    expect(screen.getByText('Barangay administrator')).toBeInTheDocument()
  })

  it('renders without a secondary line', () => {
    render(<AccountArea name="Ana Reyes" tone="default" />)

    expect(screen.getByText('Ana Reyes')).toBeInTheDocument()
  })
})
