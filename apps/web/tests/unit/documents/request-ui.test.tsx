import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import RequestsLoading from '@/app/(resident)/requests/loading'
import { EligibilityNotice } from '@/features/documents/components/eligibility-notice'
import { RequestForm } from '@/features/documents/components/request-form'
import { RequestList } from '@/features/documents/components/request-list'
import { RequestProgress } from '@/features/documents/components/request-progress'
import { SubmitRequest } from '@/features/documents/components/submit-request'
import { requestTimeline } from '@/features/documents/rules/request-timeline'
import { answerFieldName } from '@/features/documents/schemas/documents.schema'
import type { OwnRequestSummary, RequirementField } from '@/features/documents/types/documents'

/**
 * Slice 3B presentation contract for request intake and tracking.
 *
 * Two rules must never regress: a resident's own list and detail links carry
 * nothing but opaque ids, and a control is never offered for an operation the
 * database would refuse.
 */

vi.mock('@/features/documents/actions/requests', () => ({
  createRequestAction: vi.fn(),
  saveAnswersAction: vi.fn(),
  submitRequestAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

const BARANGAY = 'a0000000-0000-4000-8000-000000000001'
const REQUEST = 'f2000000-0000-4000-8000-000000000001'

function summary(overrides: Partial<OwnRequestSummary> = {}): OwnRequestSummary {
  return {
    requestId: REQUEST,
    state: 'draft',
    documentTypeName: 'Barangay Clearance (Test)',
    createdAt: '2026-08-01T00:00:00.000Z',
    submittedAt: null,
    ...overrides,
  }
}

function requirement(overrides: Partial<RequirementField> = {}): RequirementField {
  return {
    requirementId: 'f1000000-0000-4000-8000-000000000001',
    key: 'years_of_residency',
    label: 'Years of residency',
    helpText: null,
    inputKind: 'text',
    isRequired: true,
    options: [],
    ...overrides,
  }
}

describe('RequestList', () => {
  it('says so plainly when a resident has requested nothing', () => {
    render(<RequestList entries={[]} page={1} pageCount={1} total={0} />)

    expect(screen.getByText(/have not requested any documents yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('addresses a request only by opaque id (P6-C-E)', () => {
    render(<RequestList entries={[summary()]} page={1} pageCount={1} total={1} />)

    const link = screen.getByRole('link', { name: /barangay clearance/i })
    expect(link).toHaveAttribute('href', `/requests/${REQUEST}`)
    expect(link.getAttribute('href')?.toLowerCase()).not.toContain('clearance')
  })

  it('shows the resident-facing status, not the database enum', () => {
    render(
      <RequestList
        entries={[
          summary({ state: 'draft' }),
          summary({ requestId: 'f2000000-0000-4000-8000-000000000002', state: 'submitted' }),
          summary({ requestId: 'f2000000-0000-4000-8000-000000000003', state: 'in_review' }),
          summary({ requestId: 'f2000000-0000-4000-8000-000000000004', state: 'ready_for_issue' }),
        ]}
        page={1}
        pageCount={1}
        total={4}
      />,
    )

    expect(screen.getByText(/draft — not sent/i)).toBeInTheDocument()
    expect(screen.getByText(/waiting for review/i)).toBeInTheDocument()
    expect(screen.getByText(/being processed/i)).toBeInTheDocument()
    expect(screen.getByText(/ready to collect/i)).toBeInTheDocument()
    expect(screen.queryByText('ready_for_issue')).not.toBeInTheDocument()
  })

  it('names a withdrawn document type instead of leaving a gap', () => {
    render(
      <RequestList
        entries={[summary({ documentTypeName: null })]}
        page={1}
        pageCount={1}
        total={1}
      />,
    )
    expect(screen.getByRole('link', { name: /no longer offered/i })).toBeInTheDocument()
  })

  it('puts only the page number in the query string', () => {
    render(<RequestList entries={[summary()]} page={2} pageCount={3} total={25} />)

    const nav = screen.getByRole('navigation', { name: /request pages/i })
    expect(within(nav).getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/requests?page=1',
    )
    expect(within(nav).getByRole('link', { name: /next/i })).toHaveAttribute(
      'href',
      '/requests?page=3',
    )
  })
})

describe('RequestProgress', () => {
  it('shows where the request has got to, with each step named in plain words', () => {
    render(
      <RequestProgress
        steps={requestTimeline('in_review', {
          createdAt: '2026-08-01T00:00:00.000Z',
          submittedAt: '2026-08-02T00:00:00.000Z',
          reviewStartedAt: '2026-08-03T00:00:00.000Z',
          readyAt: null,
        })}
      />,
    )

    expect(screen.getByText('Saved as a draft')).toBeInTheDocument()
    expect(screen.getByText('Being processed')).toBeInTheDocument()
    // The current step also explains what happens next.
    expect(
      screen.getByText(/someone at the barangay is working on your request/i),
    ).toBeInTheDocument()
  })

  it('distinguishes the steps for assistive technology, not just by colour', () => {
    render(
      <RequestProgress
        steps={requestTimeline('submitted', {
          createdAt: '2026-08-01T00:00:00.000Z',
          submittedAt: '2026-08-02T00:00:00.000Z',
          reviewStartedAt: null,
          readyAt: null,
        })}
      />,
    )

    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('current step')).toBeInTheDocument()
    expect(screen.getAllByText('not started')).toHaveLength(2)
  })

  it('promises no step beyond the Slice 3 terminus', () => {
    render(
      <RequestProgress
        steps={requestTimeline('ready_for_issue', {
          createdAt: '2026-08-01T00:00:00.000Z',
          submittedAt: '2026-08-02T00:00:00.000Z',
          reviewStartedAt: '2026-08-03T00:00:00.000Z',
          readyAt: '2026-08-04T00:00:00.000Z',
        })}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByText(/collected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/issued/i)).not.toBeInTheDocument()
  })
})

describe('SubmitRequest', () => {
  it('offers the control only when the request is actually complete', () => {
    render(
      <SubmitRequest barangayId={BARANGAY} requestId={REQUEST} canSubmit={true} missingCount={0} />,
    )

    expect(screen.getByRole('button', { name: /submit to the barangay/i })).toBeEnabled()
    expect(screen.getByText(/can no longer be changed/i)).toBeInTheDocument()
  })

  it('disables it and says exactly what is missing', () => {
    render(
      <SubmitRequest
        barangayId={BARANGAY}
        requestId={REQUEST}
        canSubmit={false}
        missingCount={2}
      />,
    )

    expect(screen.getByRole('button', { name: /submit to the barangay/i })).toBeDisabled()
    expect(screen.getByText(/answer 2 more required questions/i)).toBeInTheDocument()
  })

  it('uses the singular for a single missing answer', () => {
    render(
      <SubmitRequest
        barangayId={BARANGAY}
        requestId={REQUEST}
        canSubmit={false}
        missingCount={1}
      />,
    )
    expect(screen.getByText(/answer 1 more required question before/i)).toBeInTheDocument()
  })
})

describe('EligibilityNotice', () => {
  it('sends an unregistered resident to onboarding', () => {
    render(<EligibilityNotice eligibility="not_registered" nextRoute="/onboarding" />)

    expect(
      screen.getByRole('heading', { name: /register as a resident first/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start my registration/i })).toHaveAttribute(
      'href',
      '/onboarding',
    )
  })

  it('tells a resident awaiting a decision that nothing is needed from them', () => {
    render(<EligibilityNotice eligibility="awaiting_decision" nextRoute="/verification" />)
    expect(screen.getByText(/nothing is needed from you right now/i)).toBeInTheDocument()
  })

  it('distinguishes "we asked you something" from "we are still looking"', () => {
    render(<EligibilityNotice eligibility="information_needed" nextRoute="/verification" />)
    expect(screen.getByRole('heading', { name: /needs more information/i })).toBeInTheDocument()
  })

  it('does not blame a rejected resident, and names who to talk to', () => {
    render(<EligibilityNotice eligibility="not_approved" nextRoute="/verification" />)
    expect(screen.getByText(/contact the barangay office/i)).toBeInTheDocument()
  })
})

describe('RequestForm — data-driven controls', () => {
  const requirements = [
    requirement({
      requirementId: 'r1',
      key: 'years',
      label: 'Years of residency',
      inputKind: 'number',
    }),
    requirement({
      requirementId: 'r2',
      key: 'intended_use',
      label: 'Intended use',
      inputKind: 'select',
      options: ['Employment', 'School'],
    }),
    requirement({
      requirementId: 'r3',
      key: 'operates_at_home',
      label: 'Operates at home',
      inputKind: 'boolean',
    }),
    requirement({
      requirementId: 'r4',
      key: 'remarks',
      label: 'Remarks',
      inputKind: 'textarea',
      isRequired: false,
      helpText: 'Anything the office should know.',
    }),
  ]

  function renderForm() {
    return render(
      <RequestForm
        barangayId={BARANGAY}
        documentTypeId="f0000000-0000-4000-8000-000000000001"
        documentTypeName="Barangay Clearance (Test)"
        requirements={requirements}
      />,
    )
  }

  it('builds one labelled control per requirement, with the right kind', () => {
    renderForm()

    expect(screen.getByLabelText(/years of residency/i)).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText(/intended use/i).tagName).toBe('SELECT')
    expect(screen.getByLabelText(/remarks/i).tagName).toBe('TEXTAREA')
  })

  it('namespaces every answer field so a requirement cannot collide with the purpose', () => {
    renderForm()

    expect(screen.getByLabelText(/years of residency/i)).toHaveAttribute(
      'name',
      answerFieldName('years'),
    )
    expect(screen.getByLabelText(/why do you need|purpose/i)).toHaveAttribute('name', 'purpose')
  })

  it('offers a boolean as an explicit yes/no rather than a checkbox', () => {
    // An unchecked box posts nothing, which is indistinguishable from an
    // unanswered required question — "no" has to be sayable.
    renderForm()

    const control = screen.getByLabelText(/operates at home/i)
    expect(control.tagName).toBe('SELECT')
    expect(within(control).getByRole('option', { name: 'Yes' })).toBeInTheDocument()
    expect(within(control).getByRole('option', { name: 'No' })).toBeInTheDocument()
  })

  it('offers exactly the choices the document type declared', () => {
    renderForm()

    const control = screen.getByLabelText(/intended use/i)
    const options = within(control)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['Choose one…', 'Employment', 'School'])
  })

  it('marks each control required or optional, and wires up its help text', () => {
    renderForm()

    expect(screen.getByLabelText(/remarks/i)).not.toBeRequired()
    expect(screen.getByLabelText(/years of residency/i)).toBeRequired()
    expect(screen.getByLabelText(/remarks/i)).toHaveAccessibleDescription(
      /anything the office should know/i,
    )
  })

  it('keeps what the resident typed — the form is controlled', async () => {
    const user = userEvent.setup()
    renderForm()

    const years = screen.getByLabelText(/years of residency/i)
    await user.type(years, '12')
    expect(years).toHaveValue(12)
  })

  it('says that saving produces a draft, not a submission', () => {
    renderForm()

    expect(screen.getByRole('button', { name: /save my request/i })).toBeInTheDocument()
    expect(screen.getByText(/nothing reaches the barangay until you submit/i)).toBeInTheDocument()
  })

  it('renders no requirement fieldset for a document that asks nothing', () => {
    render(
      <RequestForm
        barangayId={BARANGAY}
        documentTypeId="f0000000-0000-4000-8000-000000000001"
        documentTypeName="Barangay Clearance (Test)"
        requirements={[]}
      />,
    )

    expect(screen.queryByText(/what the barangay asks for/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/purpose/i)).toBeInTheDocument()
  })
})

describe('requests loading state', () => {
  it('announces progress to assistive technology', () => {
    render(<RequestsLoading />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading your document requests/i)
  })
})
