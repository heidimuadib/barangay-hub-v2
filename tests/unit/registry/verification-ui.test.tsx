import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import VerificationQueueLoading from '@/app/(staff)/staff/verification/loading'
import { ReviewActions } from '@/features/registry/components/review-actions'
import { VerificationQueue } from '@/features/registry/components/verification-queue'
import { VerificationStatusPanel } from '@/features/registry/components/verification-status'
import type { ReviewActionKey, VerificationQueueEntry } from '@/features/registry/types/registry'

/**
 * Slice 2D presentation contract: the states a reviewer and a resident
 * actually meet, and the rules that must never regress — no personal value in
 * a link target, no decision without confirmation, no colour-only meaning.
 *
 * The Server Actions the controls submit to are mocked: these tests are about
 * what is OFFERED, not what the server does with it (pgTAP and e2e cover
 * that).
 */
vi.mock('@/features/registry/actions/verification', () => ({
  startReviewAction: vi.fn(),
  requestInformationAction: vi.fn(),
  approveApplicationAction: vi.fn(),
  rejectApplicationAction: vi.fn(),
}))

// The controls refetch on success through useRefreshOnSuccess, which needs an
// App Router context jsdom does not provide.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const base: VerificationQueueEntry = {
  applicationId: 'd0000000-0000-4000-8000-000000000001',
  personId: 'c0000000-0000-4000-8000-000000000001',
  fullName: 'Applicant One (Test)',
  state: 'submitted',
  submittedAt: '2026-07-20T02:15:00.000Z',
  createdAt: '2026-07-19T02:15:00.000Z',
  sourceChannel: 'self',
  hasAccount: true,
}

function entry(overrides: Partial<VerificationQueueEntry> = {}): VerificationQueueEntry {
  return { ...base, ...overrides }
}

describe('VerificationQueue — empty states', () => {
  it('says nothing needs action on the default view', () => {
    render(<VerificationQueue entries={[]} page={1} pageCount={1} total={0} stateFilter={null} />)
    expect(screen.getByRole('status')).toHaveTextContent(/nothing needs action right now/i)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('names the filter when a filtered view is empty', () => {
    render(
      <VerificationQueue
        entries={[]}
        page={1}
        pageCount={1}
        total={0}
        stateFilter="info_requested"
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      /no application is currently info requested/i,
    )
  })
})

describe('VerificationQueue — populated', () => {
  it('shows the applicant, state and waiting-since date', () => {
    render(
      <VerificationQueue entries={[entry()]} page={1} pageCount={1} total={1} stateFilter={null} />,
    )
    const table = screen.getByRole('table', { name: /verification applications, oldest first/i })
    expect(within(table).getByText('submitted')).toBeInTheDocument()
    expect(within(table).getByText('2026-07-20')).toBeInTheDocument()
    expect(within(table).getByText('linked')).toBeInTheDocument()
  })

  it('renders table and cards so a narrow screen loses nothing', () => {
    render(
      <VerificationQueue entries={[entry()]} page={1} pageCount={1} total={1} stateFilter={null} />,
    )
    expect(screen.getAllByRole('link', { name: 'Applicant One (Test)' })).toHaveLength(2)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('states are conveyed by TEXT, not colour alone', () => {
    for (const state of ['submitted', 'in_review', 'approved', 'rejected'] as const) {
      const { unmount } = render(
        <VerificationQueue
          entries={[entry({ state })]}
          page={1}
          pageCount={1}
          total={1}
          stateFilter={null}
        />,
      )
      // Each chip carries a readable label; a screen reader gets the state.
      expect(screen.getAllByText(state.replace('_', ' ')).length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('addresses an application only by opaque id (P6-C-E)', () => {
    render(
      <VerificationQueue entries={[entry()]} page={1} pageCount={1} total={1} stateFilter={null} />,
    )
    for (const link of screen.getAllByRole('link', { name: 'Applicant One (Test)' })) {
      const href = link.getAttribute('href') ?? ''
      expect(href).toBe('/staff/verification/d0000000-0000-4000-8000-000000000001')
      expect(href.toLowerCase()).not.toContain('applicant')
    }
  })

  it('keeps the state filter in the page links and nothing else', () => {
    render(
      <VerificationQueue
        entries={[entry()]}
        page={2}
        pageCount={3}
        total={45}
        stateFilter="in_review"
      />,
    )
    const nav = screen.getByRole('navigation', { name: /queue pages/i })
    expect(within(nav).getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/staff/verification?state=in_review&page=1',
    )
    expect(within(nav).getByRole('link', { name: /next/i })).toHaveAttribute(
      'href',
      '/staff/verification?state=in_review&page=3',
    )
  })
})

describe('ReviewActions — availability by state and capability', () => {
  const props = {
    barangayId: 'a0000000-0000-4000-8000-000000000001',
    applicationId: 'd0000000-0000-4000-8000-000000000001',
    terminal: false,
    holdsAnyReviewCapability: true,
  }

  it('offers only what it is handed', () => {
    render(<ReviewActions {...props} actions={['start_review']} />)
    expect(screen.getByRole('button', { name: /start review/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
  })

  it('renders no decision control for a staff-shaped action set', () => {
    render(<ReviewActions {...props} actions={['request_information']} />)
    expect(screen.getByRole('button', { name: /request more information/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
  })

  it('explains a terminal application instead of offering actions', () => {
    render(<ReviewActions {...props} actions={[]} terminal />)
    expect(screen.getByRole('status')).toHaveTextContent(/this decision is final/i)
  })

  it('distinguishes "nothing to do now" from "not your role"', () => {
    const { unmount } = render(<ReviewActions {...props} actions={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent(/no action is available/i)
    unmount()

    render(<ReviewActions {...props} actions={[]} holdsAnyReviewCapability={false} />)
    expect(screen.getByRole('status')).toHaveTextContent(/can follow this application but not act/i)
  })
})

describe('ReviewActions — confirmation before a terminal decision', () => {
  const props = {
    barangayId: 'a0000000-0000-4000-8000-000000000001',
    applicationId: 'd0000000-0000-4000-8000-000000000001',
    terminal: false,
    holdsAnyReviewCapability: true,
    actions: ['request_information', 'approve', 'reject'] as readonly ReviewActionKey[],
  }

  it('does not submit an approval on the first click', async () => {
    const user = userEvent.setup()
    render(<ReviewActions {...props} />)

    // The opening control is a plain button, not a submit.
    const open = screen.getByRole('button', { name: /approve…/i })
    expect(open).toHaveAttribute('aria-expanded', 'false')
    await user.click(open)

    expect(open).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/approval is final/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm approval/i })).toBeInTheDocument()
  })

  it('requires a reason field before a rejection can be confirmed', async () => {
    const user = userEvent.setup()
    render(<ReviewActions {...props} />)

    await user.click(screen.getByRole('button', { name: /reject…/i }))
    const reason = screen.getByLabelText(/reason \(required\)/i)
    expect(reason).toBeRequired()
    expect(screen.getByRole('button', { name: /confirm rejection/i })).toBeInTheDocument()
    expect(screen.getByText(/shown to the resident word for word/i)).toBeInTheDocument()
  })

  it('opens one panel at a time and can be cancelled', async () => {
    const user = userEvent.setup()
    render(<ReviewActions {...props} />)

    await user.click(screen.getByRole('button', { name: /approve…/i }))
    expect(screen.getByRole('button', { name: /confirm approval/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /reject…/i }))
    expect(screen.queryByRole('button', { name: /confirm approval/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm rejection/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('button', { name: /confirm rejection/i })).not.toBeInTheDocument()
  })

  it('labels the information-request note for the resident who will read it', async () => {
    const user = userEvent.setup()
    render(<ReviewActions {...props} />)

    await user.click(screen.getByRole('button', { name: /request more information/i }))
    expect(screen.getByLabelText(/what does the resident need to provide/i)).toBeRequired()
    expect(screen.getByText(/sees this message exactly as written/i)).toBeInTheDocument()
  })
})

describe('resident status panel', () => {
  it('shows the barangay note when information was requested', () => {
    render(
      <VerificationStatusPanel
        state="info_requested"
        barangayName="San Isidro (Test)"
        infoRequestNote="Send a clearer proof of residency (synthetic)."
      />,
    )
    expect(screen.getByText(/what the barangay asked for/i)).toBeInTheDocument()
    expect(screen.getByText(/clearer proof of residency/i)).toBeInTheDocument()
  })

  it('shows the reason on a rejection and never staff-only detail', () => {
    render(
      <VerificationStatusPanel
        state="rejected"
        barangayName="San Isidro (Test)"
        decisionReason="Evidence does not establish residency (synthetic)."
      />,
    )
    expect(screen.getByText(/reason given/i)).toBeInTheDocument()
    // No reviewer identity, no internal state vocabulary.
    expect(screen.queryByText(/decided_by|in_review|reviewer id/i)).not.toBeInTheDocument()
  })
})

describe('queue loading state', () => {
  it('announces progress to assistive technology', () => {
    render(<VerificationQueueLoading />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading the verification queue/i)
  })
})
