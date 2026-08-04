import { describe, expect, it } from 'vitest'

import {
  canRequestDocuments,
  eligibilityNextRoute,
  requestEligibility,
  type RequestEligibility,
} from '@/features/documents/rules/resident-eligibility'
import type { ResidentStanding, VerificationState } from '@/features/documents/types/documents'

/**
 * Slice 3B — who may file a request.
 *
 * The rule mirrors `create_own_request`'s RESIDENT_NOT_VERIFIED gate exactly:
 * approved means eligible, everything else does not. The interesting part is
 * that "not eligible" is not one state — a resident who never registered and
 * one whose barangay asked them a question need different next steps, and
 * collapsing them into a boolean is what produces dead ends.
 */

function standing(overrides: Partial<ResidentStanding> = {}): ResidentStanding {
  return {
    personId: 'c0000000-0000-4000-8000-000000000007',
    verificationState: 'approved',
    ...overrides,
  }
}

describe('requestEligibility', () => {
  it('admits an approved resident', () => {
    expect(requestEligibility(standing())).toBe('eligible')
    expect(canRequestDocuments(standing())).toBe(true)
  })

  it('sends someone with no person record to registration', () => {
    const state = standing({ personId: null, verificationState: null })
    expect(requestEligibility(state)).toBe('not_registered')
    expect(canRequestDocuments(state)).toBe(false)
  })

  it('treats a person with no application as mid-registration', () => {
    // Reachable between `create_own_person` and `create_verification_application`.
    expect(requestEligibility(standing({ verificationState: null }))).toBe(
      'registration_incomplete',
    )
  })

  it('treats an unsubmitted draft the same as no application', () => {
    // Neither has reached the barangay, so the resident's next act is identical.
    expect(requestEligibility(standing({ verificationState: 'draft' }))).toBe(
      'registration_incomplete',
    )
  })

  it.each<VerificationState>(['submitted', 'in_review', 'resubmitted'])(
    'asks a resident in %s to wait',
    (verificationState) => {
      expect(requestEligibility(standing({ verificationState }))).toBe('awaiting_decision')
    },
  )

  it('separates "we asked you something" from "we are still looking"', () => {
    expect(requestEligibility(standing({ verificationState: 'info_requested' }))).toBe(
      'information_needed',
    )
  })

  it('refuses a rejected registration', () => {
    const state = standing({ verificationState: 'rejected' })
    expect(requestEligibility(state)).toBe('not_approved')
    expect(canRequestDocuments(state)).toBe(false)
  })

  it('never admits anyone who is not approved', () => {
    const states: (VerificationState | null)[] = [
      null,
      'draft',
      'submitted',
      'in_review',
      'info_requested',
      'resubmitted',
      'rejected',
    ]
    for (const verificationState of states) {
      expect(canRequestDocuments(standing({ verificationState }))).toBe(false)
    }
  })
})

describe('eligibilityNextRoute', () => {
  it('offers nothing to fix when the resident is already eligible', () => {
    expect(eligibilityNextRoute('eligible')).toBeNull()
  })

  it('sends an unregistered caller to onboarding, not to the status page', () => {
    expect(eligibilityNextRoute('not_registered')).toBe('/onboarding')
  })

  it.each<Exclude<RequestEligibility, 'eligible' | 'not_registered'>>([
    'registration_incomplete',
    'awaiting_decision',
    'information_needed',
    'not_approved',
  ])('sends %s to the registration they already have', (eligibility) => {
    expect(eligibilityNextRoute(eligibility)).toBe('/verification')
  })
})
