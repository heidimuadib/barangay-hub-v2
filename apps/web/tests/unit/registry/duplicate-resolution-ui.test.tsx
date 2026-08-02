import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DuplicateResolutionPanel } from '@/features/registry/components/duplicate-resolution'
import type { DuplicateComparisonRow, RegistryEntry } from '@/features/registry/types/registry'

/**
 * Slice 2E presentation contract: the comparison is explicit, the survivor is
 * a deliberate choice, the consequences are spelled out before confirmation,
 * and no personal value ever enters a link target.
 *
 * The Server Action is mocked — pgTAP and e2e prove what the server does.
 */
vi.mock('@/features/registry/actions/resolve-duplicate', () => ({
  resolveDuplicateAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const person: RegistryEntry = {
  personId: 'c0000000-0000-4000-8000-000000000005',
  fullName: 'Maria Santos (Test)',
  birthdate: '1988-08-08',
  residencyBasisKey: 'renter',
  sourceChannel: 'staff',
  superseded: false,
  hasAccount: false,
  verificationState: null,
}

const candidate: DuplicateComparisonRow = {
  personId: 'c0000000-0000-4000-8000-000000000006',
  fullName: 'María Sántos (Test)',
  birthdate: '1988-08-08',
  residencyBasisKey: 'renter',
  sourceChannel: 'staff',
  hasAccount: false,
  verificationState: null,
  similarityBand: 'near_identical',
  sameBirthdate: true,
}

const base = {
  barangayId: 'a0000000-0000-4000-8000-000000000001',
  person,
  candidates: [candidate] as readonly DuplicateComparisonRow[],
  canResolve: true,
}

describe('DuplicateResolutionPanel — empty state', () => {
  it('says plainly when no candidate exists', () => {
    render(<DuplicateResolutionPanel {...base} candidates={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent(/no similar person record was found/i)
  })
})

describe('DuplicateResolutionPanel — comparison', () => {
  it('explains WHY the candidate was flagged, as bands and signals — never decimals', () => {
    render(<DuplicateResolutionPanel {...base} />)
    expect(screen.getByText(/names are nearly identical/i)).toBeInTheDocument()
    expect(screen.getByText(/same birthdate/)).toBeInTheDocument()
    expect(screen.getByText(/signal, not proof of identity/i)).toBeInTheDocument()
    // No raw similarity number leaks into the page.
    expect(screen.queryByText(/0\.\d+/)).not.toBeInTheDocument()
  })

  it('compares the deciding fields side by side', () => {
    render(<DuplicateResolutionPanel {...base} />)
    for (const label of ['Birthdate', 'Residency', 'Recorded via', 'Account', 'Verification']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('This record')).toBeInTheDocument()
    expect(screen.getByText('Candidate')).toBeInTheDocument()
  })

  it('links the candidate by opaque id only (P6-C-E)', () => {
    render(<DuplicateResolutionPanel {...base} />)
    const link = screen.getByRole('link', { name: 'María Sántos (Test)' })
    expect(link).toHaveAttribute('href', '/staff/registry/c0000000-0000-4000-8000-000000000006')
    expect(link.getAttribute('href')).not.toMatch(/maria|santos|1988/i)
  })

  it('shows the comparison without controls when the caller cannot resolve', () => {
    render(<DuplicateResolutionPanel {...base} canResolve={false} />)
    expect(screen.getByText(/can compare but not resolve/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /resolve as the same person/i }),
    ).not.toBeInTheDocument()
  })
})

describe('DuplicateResolutionPanel — confirmation flow', () => {
  it('never resolves on the first click: survivor choice and reason stand in the way', async () => {
    const user = userEvent.setup()
    render(<DuplicateResolutionPanel {...base} />)

    const open = screen.getByRole('button', { name: /resolve as the same person/i })
    expect(open).toHaveAttribute('aria-expanded', 'false')
    await user.click(open)
    expect(open).toHaveAttribute('aria-expanded', 'true')

    // The survivor is an explicit, unpreselected choice.
    const group = screen.getByRole('group', { name: /which record should survive/i })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(2)
    for (const radio of radios) expect(radio).not.toBeChecked()

    // Consequences are spelled out in words, and the confirm stays disabled
    // until a survivor is chosen.
    expect(screen.getByText(/frozen, preserved, and pointing at the survivor/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reason \(required\)/i)).toBeRequired()
    expect(screen.getByRole('button', { name: /confirm: mark as the same person/i })).toBeDisabled()

    await user.click(within(group).getByLabelText(/this record/i))
    expect(screen.getByRole('button', { name: /confirm: mark as the same person/i })).toBeEnabled()
  })

  it('can be cancelled without consequence', async () => {
    const user = userEvent.setup()
    render(<DuplicateResolutionPanel {...base} />)

    await user.click(screen.getByRole('button', { name: /resolve as the same person/i }))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(
      screen.queryByRole('group', { name: /which record should survive/i }),
    ).not.toBeInTheDocument()
  })

  it('warns proactively when BOTH records have linked accounts', async () => {
    const user = userEvent.setup()
    render(
      <DuplicateResolutionPanel
        {...base}
        person={{ ...person, hasAccount: true }}
        candidates={[{ ...candidate, hasAccount: true }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: /resolve as the same person/i }))
    expect(screen.getByText(/both records have linked accounts/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing is ever chosen for you/i)).toBeInTheDocument()
  })

  it('explains the one-account move rule when exactly one side is linked', async () => {
    const user = userEvent.setup()
    render(<DuplicateResolutionPanel {...base} candidates={[{ ...candidate, hasAccount: true }]} />)

    await user.click(screen.getByRole('button', { name: /resolve as the same person/i }))
    expect(
      screen.getByText(/moves to the surviving record if the survivor has none/i),
    ).toBeInTheDocument()
  })
})
