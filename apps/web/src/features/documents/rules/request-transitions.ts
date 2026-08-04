import type {
  DocumentRequestState,
  RequestActionKey,
  RequestReviewerCapabilities,
} from '../types/documents'

/**
 * The request state machine (roadmap Slice 3 §4).
 *
 * The DATABASE is the authority — the guard trigger in migration
 * 20260806040000 enforces exactly this map, and pgTAP proves it. This mirror
 * exists so UI and actions can refuse impossible operations before a round
 * trip, and so the map itself is unit-testable in isolation. If the two ever
 * disagree, the SQL wins and this file has a defect.
 *
 * `ready_for_issue` is the Slice 3 terminus and the Slice 4 hand-off point:
 * issuance, serials and artifacts belong to that slice. There is deliberately
 * NO decline or cancel state — the roadmap documents four states, and
 * inventing a fifth here would be scope nobody approved (see DEC-REQ-01 in
 * docs/decisions/blockers.md).
 */
export const REQUEST_TRANSITIONS: Readonly<
  Record<DocumentRequestState, readonly DocumentRequestState[]>
> = {
  draft: ['submitted'],
  submitted: ['in_review'],
  in_review: ['ready_for_issue'],
  ready_for_issue: [],
}

/**
 * States from which nothing further can happen inside Slice 3.
 *
 * Note this is NOT the same idea as Slice 2's terminal states: a verification
 * that is approved or rejected is finished, whereas a request that is ready
 * for issue is waiting for a slice that does not exist yet.
 */
export const SLICE3_FINAL_STATES: readonly DocumentRequestState[] = ['ready_for_issue']

export function canTransition(from: DocumentRequestState, to: DocumentRequestState): boolean {
  return REQUEST_TRANSITIONS[from].includes(to)
}

export function isFinalForSlice3(state: DocumentRequestState): boolean {
  return SLICE3_FINAL_STATES.includes(state)
}

/** The only state in which the requester may still compose the request. */
export function isEditable(state: DocumentRequestState): boolean {
  return state === 'draft'
}

/** States the staff intake queue surfaces for action, in queue order. */
export function isActionableByStaff(state: DocumentRequestState): boolean {
  return state === 'submitted' || state === 'in_review'
}

/**
 * Which controls the staff request detail may offer, derived FROM the
 * transition map — not a second hand-written list — so the UI can never
 * advertise a transition the database refuses.
 */
export function availableRequestActions(
  state: DocumentRequestState,
  capabilities: RequestReviewerCapabilities,
): readonly RequestActionKey[] {
  const actions: RequestActionKey[] = []
  if (canTransition(state, 'in_review') && capabilities.canReview) {
    actions.push('start_review')
  }
  if (canTransition(state, 'ready_for_issue') && capabilities.canMarkReady) {
    actions.push('mark_ready')
  }
  return actions
}

export type RequesterNextStep = 'complete_request' | 'wait' | 'collect' | 'none'

/** The single next thing the REQUESTER can do, per state. */
export function requesterNextStep(state: DocumentRequestState): RequesterNextStep {
  switch (state) {
    case 'draft':
      return 'complete_request'
    case 'submitted':
    case 'in_review':
      return 'wait'
    case 'ready_for_issue':
      return 'collect'
  }
}

/**
 * Whether every required requirement has an answer.
 *
 * Mirrors the `REQUIREMENTS_INCOMPLETE` gate in `submit_request` so a form can
 * disable its submit control with the same rule the database will apply —
 * and so the reason is explainable before the round trip rather than after it.
 */
export function missingRequirementKeys(
  requirements: readonly { key: string; isRequired: boolean }[],
  answers: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  return requirements
    .filter((requirement) => requirement.isRequired)
    .filter((requirement) => {
      const answer = answers[requirement.key]
      return answer === undefined || answer.trim() === ''
    })
    .map((requirement) => requirement.key)
}

export function canSubmit(
  state: DocumentRequestState,
  requirements: readonly { key: string; isRequired: boolean }[],
  answers: Readonly<Record<string, string | undefined>>,
): boolean {
  return state === 'draft' && missingRequirementKeys(requirements, answers).length === 0
}
