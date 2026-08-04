import { describe, expect, it } from 'vitest'

import {
  REQUEST_TRANSITIONS,
  SLICE3_FINAL_STATES,
  availableRequestActions,
  canSubmit,
  canTransition,
  isActionableByStaff,
  isEditable,
  isFinalForSlice3,
  missingRequirementKeys,
  requesterNextStep,
} from '@/features/documents/rules/request-transitions'
import type { DocumentRequestState } from '@/features/documents/types/documents'

const ALL_STATES: DocumentRequestState[] = ['draft', 'submitted', 'in_review', 'ready_for_issue']

describe('request state machine', () => {
  it('matches the roadmap chain exactly, with no extra edges', () => {
    // Roadmap Slice 3 §4: draft → submitted → in_review → ready_for_issue.
    // Written as the full edge set rather than spot checks, so an added
    // transition fails here and not in a pilot.
    const edges = ALL_STATES.flatMap((from) =>
      REQUEST_TRANSITIONS[from].map((to) => `${from}->${to}`),
    )
    expect(edges).toEqual([
      'draft->submitted',
      'submitted->in_review',
      'in_review->ready_for_issue',
    ])
  })

  it('covers every state, so a new enum member cannot be silently unhandled', () => {
    expect(Object.keys(REQUEST_TRANSITIONS).sort()).toEqual([...ALL_STATES].sort())
  })

  it('refuses backwards and skipping transitions', () => {
    expect(canTransition('submitted', 'draft')).toBe(false)
    expect(canTransition('draft', 'in_review')).toBe(false)
    expect(canTransition('draft', 'ready_for_issue')).toBe(false)
    expect(canTransition('in_review', 'submitted')).toBe(false)
  })

  it('has no transition out of ready_for_issue — Slice 4 owns what happens next', () => {
    expect(REQUEST_TRANSITIONS.ready_for_issue).toEqual([])
    expect(isFinalForSlice3('ready_for_issue')).toBe(true)
    expect(SLICE3_FINAL_STATES).toEqual(['ready_for_issue'])
  })

  it('allows editing only while drafting', () => {
    expect(isEditable('draft')).toBe(true)
    for (const state of ALL_STATES.filter((s) => s !== 'draft')) {
      expect(isEditable(state), `${state} must not be editable`).toBe(false)
    }
  })

  it('surfaces exactly the actionable states to the staff queue', () => {
    expect(ALL_STATES.filter(isActionableByStaff)).toEqual(['submitted', 'in_review'])
  })

  it('gives the requester one next step per state', () => {
    expect(requesterNextStep('draft')).toBe('complete_request')
    expect(requesterNextStep('submitted')).toBe('wait')
    expect(requesterNextStep('in_review')).toBe('wait')
    expect(requesterNextStep('ready_for_issue')).toBe('collect')
  })
})

describe('available request actions', () => {
  const all = { canReview: true, canMarkReady: true }

  it('offers review only on a submitted request', () => {
    expect(availableRequestActions('submitted', all)).toEqual(['start_review'])
    expect(availableRequestActions('draft', all)).toEqual([])
  })

  it('offers mark-ready only from review', () => {
    expect(availableRequestActions('in_review', all)).toEqual(['mark_ready'])
  })

  it('offers nothing once the request is ready for issue', () => {
    expect(availableRequestActions('ready_for_issue', all)).toEqual([])
  })

  it('never advertises an action the caller lacks the capability for', () => {
    // Front-desk staff hold requests.review but not requests.mark_ready.
    const staff = { canReview: true, canMarkReady: false }
    expect(availableRequestActions('submitted', staff)).toEqual(['start_review'])
    expect(availableRequestActions('in_review', staff)).toEqual([])
  })

  it('offers nothing at all to someone with no capability', () => {
    const none = { canReview: false, canMarkReady: false }
    for (const state of ALL_STATES) {
      expect(availableRequestActions(state, none), state).toEqual([])
    }
  })
})

describe('submission completeness', () => {
  const requirements = [
    { key: 'years_of_residency', isRequired: true },
    { key: 'intended_use', isRequired: true },
    { key: 'remarks', isRequired: false },
  ]

  it('names every unanswered required requirement', () => {
    expect(missingRequirementKeys(requirements, {})).toEqual(['years_of_residency', 'intended_use'])
  })

  it('ignores optional requirements', () => {
    const answers = { years_of_residency: '7', intended_use: 'Employment' }
    expect(missingRequirementKeys(requirements, answers)).toEqual([])
    expect(canSubmit('draft', requirements, answers)).toBe(true)
  })

  it('treats a whitespace-only answer as missing', () => {
    // The database CHECK requires btrim(value) <> '', so accepting it here
    // would let the form promise a submission the database refuses.
    const answers = { years_of_residency: '   ', intended_use: 'Employment' }
    expect(missingRequirementKeys(requirements, answers)).toEqual(['years_of_residency'])
    expect(canSubmit('draft', requirements, answers)).toBe(false)
  })

  it('refuses submission from any state but draft, however complete', () => {
    const answers = { years_of_residency: '7', intended_use: 'Employment' }
    expect(canSubmit('submitted', requirements, answers)).toBe(false)
    expect(canSubmit('in_review', requirements, answers)).toBe(false)
    expect(canSubmit('ready_for_issue', requirements, answers)).toBe(false)
  })
})
