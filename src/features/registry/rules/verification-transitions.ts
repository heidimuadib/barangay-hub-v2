import type { ReviewActionKey, ReviewerCapabilities, VerificationState } from '../types/registry'

/**
 * The verification state machine (roadmap Slice 2 §4; ADR-0006).
 *
 * The DATABASE is the authority — the trigger in migration 20260802040000
 * enforces exactly this map, and pgTAP proves it. This mirror exists so UI
 * and actions can refuse impossible operations before a round trip, and so
 * the map itself is unit-testable in isolation. If the two ever disagree,
 * the SQL wins and this file has a defect.
 *
 * Terminal states are locked: no transition leaves `approved` or `rejected`.
 * A NEW application is the only way forward after a terminal state.
 */
export const VERIFICATION_TRANSITIONS: Readonly<
  Record<VerificationState, readonly VerificationState[]>
> = {
  draft: ['submitted'],
  submitted: ['in_review'],
  resubmitted: ['in_review'],
  in_review: ['info_requested', 'approved', 'rejected'],
  info_requested: ['resubmitted'],
  approved: [],
  rejected: [],
}

export const TERMINAL_STATES: readonly VerificationState[] = ['approved', 'rejected']

export function canTransition(from: VerificationState, to: VerificationState): boolean {
  return VERIFICATION_TRANSITIONS[from].includes(to)
}

export function isTerminal(state: VerificationState): boolean {
  return TERMINAL_STATES.includes(state)
}

/** States in which the resident (or assisting staff) may edit evidence. */
export function isEditable(state: VerificationState): boolean {
  return state === 'draft' || state === 'info_requested'
}

/** States a staff queue surfaces for action, in queue order. */
export function isActionableByStaff(state: VerificationState): boolean {
  return state === 'submitted' || state === 'resubmitted' || state === 'in_review'
}

/** Rejection is the only transition that REQUIRES a reason (ADR-0006). */
export function requiresReason(to: VerificationState): boolean {
  return to === 'rejected'
}

// ── Reviewer action availability (Slice 2D) ─────────────────────────────────
// The ReviewActionKey / ReviewerCapabilities types live in ../types/registry
// so components may reference them (feature-component may import feature-type
// but not feature-rule — Phase 6 §16.1).

export type { ReviewActionKey, ReviewerCapabilities }

/**
 * Which controls the review detail may offer, derived FROM the transition
 * map — not a second hand-written list — so the UI can never advertise a
 * transition the database refuses. Note there is no decision from
 * `resubmitted`: the committed machine routes it through `in_review` first.
 */
export function availableReviewActions(
  state: VerificationState,
  capabilities: ReviewerCapabilities,
): readonly ReviewActionKey[] {
  const actions: ReviewActionKey[] = []
  if (canTransition(state, 'in_review') && capabilities.canReview) {
    actions.push('start_review')
  }
  if (canTransition(state, 'info_requested') && capabilities.canRequestInformation) {
    actions.push('request_information')
  }
  if (canTransition(state, 'approved') && capabilities.canApprove) {
    actions.push('approve')
  }
  if (canTransition(state, 'rejected') && capabilities.canReject) {
    actions.push('reject')
  }
  return actions
}

/** Terminal decisions get an explicit confirmation step in the UI. */
export function isDecisionAction(action: ReviewActionKey): boolean {
  return action === 'approve' || action === 'reject'
}

export type ResidentNextStep =
  'complete_documents' | 'wait' | 'resubmit' | 'new_application' | 'none'

/** The single next thing the RESIDENT can do, per state. */
export function residentNextStep(state: VerificationState): ResidentNextStep {
  switch (state) {
    case 'draft':
      return 'complete_documents'
    case 'submitted':
    case 'in_review':
    case 'resubmitted':
      return 'wait'
    case 'info_requested':
      return 'resubmit'
    case 'rejected':
      return 'new_application'
    case 'approved':
      return 'none'
  }
}
