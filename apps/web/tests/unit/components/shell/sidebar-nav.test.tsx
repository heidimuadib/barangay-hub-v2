import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarNav, type NavSection } from '@/components/shell'

/**
 * UI-B — the navigation list's accessibility contract.
 *
 * The legacy sidebar communicated "you are here" with a translucent white wash
 * and nothing else. These assertions are the things that wash could not do.
 */

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => '/staff') }))
vi.mock('next/navigation', () => ({ usePathname }))

const SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [{ href: '/staff', label: 'Dashboard', icon: 'home', exact: true }],
  },
  {
    title: 'Residents',
    items: [
      { href: '/staff/registry', label: 'Registry', icon: 'id-card' },
      { href: '/staff/verification', label: 'Verification', icon: 'shield-check' },
    ],
  },
]

beforeEach(() => {
  usePathname.mockReturnValue('/staff')
})

describe('SidebarNav', () => {
  it('renders every item in every section', () => {
    render(<SidebarNav sections={SECTIONS} tone="brand" />)

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registry' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Verification' })).toBeInTheDocument()
  })

  it('groups items under a heading and labels the list with it', () => {
    render(<SidebarNav sections={SECTIONS} tone="brand" />)

    // The sighted grouping legacy showed with an eyebrow is announced too.
    const residents = screen.getByRole('list', { name: 'Residents' })
    expect(within(residents).getAllByRole('link')).toHaveLength(2)
  })

  it('marks the current route with aria-current, not colour alone', () => {
    usePathname.mockReturnValue('/staff/registry')
    render(<SidebarNav sections={SECTIONS} tone="brand" />)

    expect(screen.getByRole('link', { name: 'Registry' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Verification' })).not.toHaveAttribute('aria-current')
  })

  it('keeps the parent current on a detail route', () => {
    usePathname.mockReturnValue('/staff/registry/c0000000-0000-4000-8000-000000000004')
    render(<SidebarNav sections={SECTIONS} tone="brand" />)

    expect(screen.getByRole('link', { name: 'Registry' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark an exact item current on its descendants', () => {
    usePathname.mockReturnValue('/staff/registry')
    render(<SidebarNav sections={SECTIONS} tone="brand" />)

    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it('gives every row the 44px touch-target floor', () => {
    // Legacy shipped nav rows at `p-2.5` — about 38px — and a nav row is the
    // most-tapped control in the product.
    render(<SidebarNav sections={SECTIONS} tone="brand" />)

    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('min-h-11')
    }
  })

  it('keeps the row icon decorative so the label is not announced twice', () => {
    const { container } = render(<SidebarNav sections={SECTIONS} tone="brand" />)

    for (const svg of container.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('renders the same links on every tone', () => {
    for (const tone of ['brand', 'light', 'dark'] as const) {
      const { unmount } = render(<SidebarNav sections={SECTIONS} tone={tone} />)
      expect(screen.getByRole('link', { name: 'Registry' })).toBeInTheDocument()
      unmount()
    }
  })
})
