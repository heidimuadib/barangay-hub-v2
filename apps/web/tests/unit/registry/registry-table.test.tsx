import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import RegistryLoading from '@/app/(staff)/staff/registry/loading'
import { RegistryTable } from '@/features/registry/components/registry-table'
import type { RegistryEntry } from '@/features/registry/types/registry'

/**
 * Slice 2C presentation contract.
 *
 * The states a staff member actually meets — empty, populated, paginated,
 * superseded — plus the one rule that must never regress: a resident's
 * details never appear in a link target.
 */

const base: RegistryEntry = {
  personId: 'c0000000-0000-4000-8000-000000000004',
  fullName: 'Juan Dela Cruz (Test)',
  birthdate: '1970-06-15',
  residencyBasisKey: 'property_owner',
  sourceChannel: 'staff',
  superseded: false,
  hasAccount: false,
  verificationState: null,
}

function entry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return { ...base, ...overrides }
}

describe('RegistryTable — empty state', () => {
  it('explains what to do instead of showing an empty grid', () => {
    render(<RegistryTable entries={[]} page={1} pageCount={1} total={0} />)

    expect(
      screen.getByText(/no residents are registered in this barangay yet/i),
    ).toBeInTheDocument()
    // No table chrome, and no pagination for nothing.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /registry pages/i })).not.toBeInTheDocument()
  })
})

describe('RegistryTable — populated', () => {
  it('shows identity, residency, account linkage and verification state', () => {
    render(
      <RegistryTable
        entries={[entry({ verificationState: 'approved', hasAccount: true })]}
        page={1}
        pageCount={1}
        total={1}
      />,
    )

    const table = screen.getByRole('table', { name: /residents in this barangay/i })
    expect(within(table).getByText('Property owner')).toBeInTheDocument()
    expect(within(table).getByText('linked')).toBeInTheDocument()
    expect(within(table).getByText('approved')).toBeInTheDocument()
  })

  it('labels a walk-in so staff know the record has no account behind it', () => {
    render(<RegistryTable entries={[entry()]} page={1} pageCount={1} total={1} />)
    expect(screen.getAllByText(/walk-in/i).length).toBeGreaterThan(0)
  })

  it('marks a superseded record instead of showing a verification state', () => {
    render(
      <RegistryTable
        entries={[entry({ superseded: true, verificationState: 'approved' })]}
        page={1}
        pageCount={1}
        total={1}
      />,
    )

    expect(screen.getAllByText('superseded').length).toBeGreaterThan(0)
    expect(screen.queryByText('approved')).not.toBeInTheDocument()
  })

  it('says so plainly when a person has no application yet', () => {
    render(<RegistryTable entries={[entry()]} page={1} pageCount={1} total={1} />)
    expect(screen.getAllByText(/no application/i).length).toBeGreaterThan(0)
  })

  it('renders both the table and the card list so narrow screens lose nothing', () => {
    render(<RegistryTable entries={[entry()]} page={1} pageCount={1} total={1} />)

    // Same person, two presentations: the sm: breakpoint picks one.
    const links = screen.getAllByRole('link', { name: 'Juan Dela Cruz (Test)' })
    expect(links).toHaveLength(2)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })
})

describe('RegistryTable — link targets carry no personal data (P6-C-E)', () => {
  it('addresses a person only by opaque id', () => {
    render(
      <RegistryTable
        entries={[entry({ fullName: 'Juan Dela Cruz (Test)', birthdate: '1970-06-15' })]}
        page={1}
        pageCount={1}
        total={1}
      />,
    )

    for (const link of screen.getAllByRole('link', { name: 'Juan Dela Cruz (Test)' })) {
      const href = link.getAttribute('href') ?? ''
      expect(href).toBe('/staff/registry/c0000000-0000-4000-8000-000000000004')
      expect(href.toLowerCase()).not.toContain('juan')
      expect(href.toLowerCase()).not.toContain('cruz')
      expect(href).not.toContain('1970')
    }
  })
})

describe('RegistryTable — pagination', () => {
  it('puts only the page number in the query string', () => {
    render(<RegistryTable entries={[entry()]} page={2} pageCount={3} total={45} />)

    const nav = screen.getByRole('navigation', { name: /registry pages/i })
    expect(within(nav).getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/staff/registry?page=1',
    )
    expect(within(nav).getByRole('link', { name: /next/i })).toHaveAttribute(
      'href',
      '/staff/registry?page=3',
    )
    expect(within(nav).getByText(/page 2 of 3 · 45 residents/i)).toBeInTheDocument()
  })

  it('omits the edges: no Previous on the first page, no Next on the last', () => {
    const { unmount } = render(
      <RegistryTable entries={[entry()]} page={1} pageCount={2} total={2} />,
    )
    expect(screen.queryByRole('link', { name: /previous/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /next/i })).toBeInTheDocument()
    unmount()

    render(<RegistryTable entries={[entry()]} page={2} pageCount={2} total={2} />)
    expect(screen.getByRole('link', { name: /previous/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /next/i })).not.toBeInTheDocument()
  })

  it('uses the singular for a lone resident', () => {
    render(<RegistryTable entries={[entry()]} page={1} pageCount={1} total={1} />)
    expect(screen.getByText(/1 resident$/i)).toBeInTheDocument()
  })
})

describe('registry loading state', () => {
  it('announces progress to assistive technology', () => {
    render(<RegistryLoading />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading the resident registry/i)
  })
})
