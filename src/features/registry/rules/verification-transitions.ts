import type { VerificationState } from '../types/registry'

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
