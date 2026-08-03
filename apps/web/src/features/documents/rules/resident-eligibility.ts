import type { ResidentStanding, VerificationState } from '../types/documents'

/**
 * Who may file a document request (roadmap Slice 3 §3, ADR-0006 point 4).
 *
 * The rule is "a VERIFIED resident", and the interesting part is everything
 * that is not verified: onboarding creates a person record immediately, so
 * "has a record" and "has standing" are different facts, and a resident stuck
 * between them deserves to be told which one they are missing.
 *
 * This mirrors — never replaces — `create_own_request`, which raises
 * `RESIDENT_NOT_VERIFIED` on the same condition (migration 20260807010000).
 * The database is the authority; this exists so the screen can explain the
 * refusal and point at the next step instead of offering a control that will
 * fail.
 */

export type RequestEligibility =
  /** Approved: may create requests. */
  | 'eligible'
  /** No person record in this barangay — they never onboarded. */
  | 'not_registered'
  /** A record exists but the application has not been submitted. */
  | 'registration_incomplete'
  /** With the barangay; nothing for the resident to do. */
  | 'awaiting_decision'
  /** The barangay asked for something — the resident must act. */
  | 'information_needed'
  /** Decided, and not in the resident's favour. */
  | 'not_approved'

export function requestEligibility(standing: ResidentStanding): RequestEligibility {
  if (standing.personId === null) return 'not_registered'
  return eligibilityForState(standing.verificationState)
}

function eligibilityForState(state: VerificationState | null): RequestEligibility {
  // A person with no application at all is mid-onboarding, which is the same
  // position as one holding a draft: the barangay has not been asked yet.
  if (state === null) return 'registration_incomplete'

  switch (state) {
    case 'approved':
      return 'eligible'
    case 'draft':
      return 'registration_incomplete'
    case 'submitted':
    case 'in_review':
    case 'resubmitted':
      return 'awaiting_decision'
    case 'info_requested':
      return 'information_needed'
    case 'rejected':
      return 'not_approved'
  }
}

/** The single predicate every surface gates on. */
export function canRequestDocuments(standing: ResidentStanding): boolean {
  return requestEligibility(standing) === 'eligible'
}

/**
 * Where an ineligible resident should be sent.
 *
 * Returned as a route rather than rendered copy so the refusal panel and the
 * catalog's call to action cannot disagree about where "fix this" leads.
 */
export function eligibilityNextRoute(eligibility: RequestEligibility): string | null {
  switch (eligibility) {
    case 'eligible':
      return null
    case 'not_registered':
      return '/onboarding'
    case 'registration_incomplete':
    case 'awaiting_decision':
    case 'information_needed':
    case 'not_approved':
      return '/verification'
  }
}
