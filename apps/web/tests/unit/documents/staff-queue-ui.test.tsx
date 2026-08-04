import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import StaffRequestsLoading from '@/app/(staff)/staff/requests/loading'
import {
  RequestQueue,
  RequestQueueChip,
  RequestQueueFilters,
} from '@/features/documents/components/request-queue'
import { RequestReviewActions } from '@/features/documents/components/request-review-actions'
import { availableRequestActions } from '@/features/documents/rules/request-transitions'
import {
  REQUEST_STATE_KEYS,
  requestQueueFilterSchema,
} from '@/features/documents/schemas/documents.schema'
import type { RequestQueueEntry } from '@/features/documents/types/documents'

/**
 * Slice 3C presentation contract for the staff intake queue.
 *
 * Two rules must never regress: the queue addresses requests by opaque id
 * only, and a control is never offered for a transition the caller's role or
 * the request's state forbids.
 */

vi.mock('@/features/documents/actions/staff-requests', () => ({
  startReviewAction: vi.fn(),
  markReadyAction: vi.fn(),
  createWalkInRequestAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

const BARANGAY = 'a0000000-0000-4000-8000-000000000001'
const REQUEST = 'f2000000-0000-4000-8000-000000000002'

function entry(overrides: Partial<RequestQueueEntry> = {}): RequestQueueEntry {
  return {
    requestId: REQUEST,
    state: 'submitted',
    documentTypeName: 'Barangay Clearance (Test)',
    requesterName: 'Juan Dela Cruz (Test)',
    sourceChannel: 'self',
    hasAccount: true,
    submittedAt: '2026-08-02T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('RequestQueue — empty states', () => {
  it('explains the default view rather than showing an empty grid', () => {
    render(<RequestQueue entries={[]} page={1} pageCount={1} total={0} stateFilter={null} />)

    expect(screen.getByRole('status')).toHaveTextContent(/nothing needs action right now/i)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('names the filter when a filtered view is empty', () => {
    render(
      <RequestQueue entries={[]} page={1} pageCount={1} total={0} stateFilter="ready_for_issue" />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/no request is currently ready for issue/i)
  })
})

describe('RequestQueue — rows', () => {
  it('addresses a request by opaque id, never by the requester (P6-C-E)', () => {
    render(<RequestQueue entries={[entry()]} page={1} pageCount={1} total={1} stateFilter={null} />)

    for (const link of screen.getAllByRole('link', { name: 'Juan Dela Cruz (Test)' })) {
      const href = link.getAttribute('href') ?? ''
      expect(href).toBe(`/staff/requests/${REQUEST}`)
      expect(href.toLowerCase()).not.toContain('juan')
      expect(href.toLowerCase()).not.toContain('clearance')
    }
  })

  it('renders both a table and a card list so a phone loses nothing', () => {
    render(<RequestQueue entries={[entry()]} page={1} pageCount={1} total={1} stateFilter={null} />)

    // Same request, two presentations: the sm: breakpoint picks one.
    expect(screen.getAllByRole('link', { name: 'Juan Dela Cruz (Test)' })).toHaveLength(2)
    expect(screen.getByRole('table', { name: /document requests, oldest first/i })).toBeVisible()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('marks a counter-filed request as a walk-in', () => {
    render(
      <RequestQueue
        entries={[entry({ sourceChannel: 'staff', hasAccount: false })]}
        page={1}
        pageCount={1}
        total={1}
        stateFilter={null}
      />,
    )
    expect(screen.getAllByText(/walk-in/i).length).toBeGreaterThan(0)
  })

  it('says so plainly when the caller may not read the requester’s name', () => {
    // Reachable only if a role holds requests.read without registry.read. The
    // queue must not invent a placeholder that hides the mapping mistake.
    render(
      <RequestQueue
        entries={[entry({ requesterName: null })]}
        page={1}
        pageCount={1}
        total={1}
        stateFilter={null}
      />,
    )
    expect(screen.getAllByText(/name not available to your role/i).length).toBeGreaterThan(0)
  })

  it('names a withdrawn document type instead of leaving a gap', () => {
    render(
      <RequestQueue
        entries={[entry({ documentTypeName: null })]}
        page={1}
        pageCount={1}
        total={1}
        stateFilter={null}
      />,
    )
    expect(screen.getAllByText(/no longer offered/i).length).toBeGreaterThan(0)
  })

  it('carries the state filter through pagination links', () => {
    render(
      <RequestQueue
        entries={[entry()]}
        page={2}
        pageCount={3}
        total={50}
        stateFilter="submitted"
      />,
    )

    const nav = screen.getByRole('navigation', { name: /queue pages/i })
    expect(within(nav).getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/staff/requests?state=submitted&page=1',
    )
    expect(within(nav).getByRole('link', { name: /next/i })).toHaveAttribute(
      'href',
      '/staff/requests?state=submitted&page=3',
    )
  })
})

describe('RequestQueueFilters', () => {
  it('marks the active filter for assistive technology, not just by colour', () => {
    render(<RequestQueueFilters active="in_review" />)

    const nav = screen.getByRole('navigation', { name: /filter by state/i })
    expect(within(nav).getByRole('link', { name: 'In review' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Needs action' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('offers no filter for other people’s unfinished drafts', () => {
    // A draft belongs to the resident composing it and has been sent to
    // nobody — a staff filter for it would be a surveillance surface.
    render(<RequestQueueFilters active={null} />)
    expect(screen.queryByRole('link', { name: /^draft$/i })).not.toBeInTheDocument()
  })

  it('sends the default view to a parameter-less URL', () => {
    render(<RequestQueueFilters active="submitted" />)
    expect(screen.getByRole('link', { name: 'Needs action' })).toHaveAttribute(
      'href',
      '/staff/requests',
    )
  })
})

describe('RequestQueueChip', () => {
  it('uses factual staff wording, not the resident reassurance copy', () => {
    render(<RequestQueueChip state="ready_for_issue" />)
    expect(screen.getByText('ready for issue')).toBeInTheDocument()
    expect(screen.queryByText(/ready to collect/i)).not.toBeInTheDocument()
  })
})

describe('RequestReviewActions — the capability split', () => {
  it('offers start-review to a reviewer on a submitted request', () => {
    const actions = availableRequestActions('submitted', {
      canReview: true,
      canMarkReady: false,
    })
    render(<RequestReviewActions barangayId={BARANGAY} requestId={REQUEST} actions={actions} />)

    expect(screen.getByRole('button', { name: /start review/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark ready/i })).not.toBeInTheDocument()
  })

  it('withholds mark-ready from a role that may only review', () => {
    const actions = availableRequestActions('in_review', {
      canReview: true,
      canMarkReady: false,
    })
    render(<RequestReviewActions barangayId={BARANGAY} requestId={REQUEST} actions={actions} />)

    expect(screen.queryByRole('button', { name: /mark ready/i })).not.toBeInTheDocument()
    expect(screen.getByText(/nothing for you to do/i)).toBeInTheDocument()
  })

  it('offers mark-ready to an administrator on an in-review request', () => {
    const actions = availableRequestActions('in_review', { canReview: true, canMarkReady: true })
    render(<RequestReviewActions barangayId={BARANGAY} requestId={REQUEST} actions={actions} />)

    expect(screen.getByRole('button', { name: /mark ready to collect/i })).toBeInTheDocument()
    // ...and explains what that promise means to the resident.
    expect(screen.getByText(/tells the resident their document is ready/i)).toBeInTheDocument()
  })

  it('offers nothing at the Slice 3 terminus, whatever the caller holds', () => {
    const actions = availableRequestActions('ready_for_issue', {
      canReview: true,
      canMarkReady: true,
    })
    render(<RequestReviewActions barangayId={BARANGAY} requestId={REQUEST} actions={actions} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/nothing for you to do/i)).toBeInTheDocument()
  })
})

describe('requestQueueFilterSchema', () => {
  it('accepts the fixed state vocabulary and a page number', () => {
    for (const state of REQUEST_STATE_KEYS) {
      expect(requestQueueFilterSchema.safeParse({ state }).success).toBe(true)
    }
    expect(requestQueueFilterSchema.safeParse({ page: '3' }).data?.page).toBe(3)
  })

  it('refuses anything outside the vocabulary rather than echoing it', () => {
    expect(requestQueueFilterSchema.safeParse({ state: 'approved' }).success).toBe(false)
    expect(requestQueueFilterSchema.safeParse({ state: '<script>' }).success).toBe(false)
  })

  it('refuses a page that is not a sane positive number', () => {
    expect(requestQueueFilterSchema.safeParse({ page: '0' }).success).toBe(false)
    expect(requestQueueFilterSchema.safeParse({ page: '-2' }).success).toBe(false)
    expect(requestQueueFilterSchema.safeParse({ page: '99999999' }).success).toBe(false)
  })
})

describe('staff queue loading state', () => {
  it('announces progress to assistive technology', () => {
    render(<StaffRequestsLoading />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading the document request queue/i)
  })
})
