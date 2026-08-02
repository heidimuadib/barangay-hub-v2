import { describe, expect, it } from 'vitest'

import {
  availableReviewActions,
  isDecisionAction,
  residentNextStep,
  VERIFICATION_TRANSITIONS,
} from '@/features/registry/rules/verification-transitions'
import type { ReviewerCapabilities, VerificationState } from '@/features/registry/types/registry'

/**
 * Slice 2D action-availability rule.
 *
 * The rule derives from the transition map rather than restating it, so the
 * tests that matter most are the ones proving the UI can never advertise a
 * transition the database refuses.
 */

const ALL_STATES: readonly VerificationState[] = [
  'draft',
  'submitted',
  'in_review',
  'info_requested',
  'resubmitted',
  'approved',
  'rejected',
]

const STAFF: ReviewerCapabilities = {
  canReview: true,
  canRequestInformation: true,
  canApprove: false,
  canReject: false,
}

const ADMIN: ReviewerCapabilities = {
  canReview: true,
  canRequestInformation: true,
  canApprove: true,
  canReject: true,
}

const READ_ONLY: ReviewerCapabilities = {
  canReview: false,
  canRequestInformation: false,
  canApprove: false,
  canReject: false,
}

describe('availableReviewActions — capability split (ADR-0006 §D2-04)', () => {
  it('offers staff review and information requests but never a decision', () => {
    expect(availableReviewActions('submitted', STAFF)).toEqual(['start_review'])
    expect(availableReviewActions('in_review', STAFF)).toEqual(['request_information'])
    // The states where an administrator could decide offer staff nothing more.
    expect(availableReviewActions('in_review', STAFF)).not.toContain('approve')
    expect(availableReviewActions('in_review', STAFF)).not.toContain('reject')
  })

  it('offers an administrator the full set in review', () => {
    expect(availableReviewActions('in_review', ADMIN)).toEqual([
      'request_information',
      'approve',
      'reject',
    ])
  })

  it('offers a read-only holder nothing in any state', () => {
    for (const state of ALL_STATES) {
      expect(availableReviewActions(state, READ_ONLY)).toEqual([])
    }
  })
})

describe('availableReviewActions — state gating', () => {
  it('routes a resubmission back through review before any decision', () => {
    // The committed machine has no resubmitted → approved edge; the UI must
    // not imply one.
    expect(availableReviewActions('resubmitted', ADMIN)).toEqual(['start_review'])
  })

  it('offers nothing on a terminal application, to anyone', () => {
    expect(availableReviewActions('approved', ADMIN)).toEqual([])
    expect(availableReviewActions('rejected', ADMIN)).toEqual([])
  })

  it('offers nothing while the resident still holds the turn', () => {
    // info_requested exits only by the resident resubmitting.
    expect(availableReviewActions('info_requested', ADMIN)).toEqual([])
    // A draft has not been submitted yet.
    expect(availableReviewActions('draft', ADMIN)).toEqual([])
  })

  it('never offers an action the transition map refuses', () => {
    const TARGET: Record<string, VerificationState> = {
      start_review: 'in_review',
      request_information: 'info_requested',
      approve: 'approved',
      reject: 'rejected',
    }
    for (const state of ALL_STATES) {
      for (const action of availableReviewActions(state, ADMIN)) {
        const target = TARGET[action]
        expect(target).toBeDefined()
        expect(VERIFICATION_TRANSITIONS[state]).toContain(target)
      }
    }
  })
})

describe('isDecisionAction', () => {
  it('marks exactly the two terminal decisions for confirmation', () => {
    expect(isDecisionAction('approve')).toBe(true)
    expect(isDecisionAction('reject')).toBe(true)
    expect(isDecisionAction('start_review')).toBe(false)
    expect(isDecisionAction('request_information')).toBe(false)
  })
})

describe('residentNextStep', () => {
  it('names one next step per state, and only resubmit is actionable mid-flight', () => {
    expect(residentNextStep('draft')).toBe('complete_documents')
    expect(residentNextStep('submitted')).toBe('wait')
    expect(residentNextStep('in_review')).toBe('wait')
    expect(residentNextStep('resubmitted')).toBe('wait')
    expect(residentNextStep('info_requested')).toBe('resubmit')
    expect(residentNextStep('rejected')).toBe('new_application')
    expect(residentNextStep('approved')).toBe('none')
  })

  it('agrees with the transition map about who holds the turn', () => {
    // Wherever the resident is told to wait, they have no legal transition of
    // their own — the only exit is a staff action.
    for (const state of ALL_STATES) {
      if (residentNextStep(state) === 'wait') {
        expect(VERIFICATION_TRANSITIONS[state]).not.toContain('resubmitted')
      }
    }
    expect(VERIFICATION_TRANSITIONS.info_requested).toContain('resubmitted')
  })
})
