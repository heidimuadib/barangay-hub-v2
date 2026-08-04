import type { DocumentRequestState } from '../types/documents'

/**
 * The resident-facing progress readout for one request.
 *
 * Derived from the SAME ordered state list the transition map is built on, so
 * a timeline can never advertise a step the database would refuse. Slice 3
 * ends at `ready_for_issue`; collection and issuance are Slice 4 and are
 * deliberately not drawn here as a future step, because promising a step that
 * does not exist yet is the kind of thing residents plan a trip around.
 */

/** Lifecycle order. `draft` is included: a resident's own draft is real to them. */
export const REQUEST_PROGRESSION: readonly DocumentRequestState[] = [
  'draft',
  'submitted',
  'in_review',
  'ready_for_issue',
]

export type TimelineStatus = 'done' | 'current' | 'upcoming'

export interface TimelineStep {
  readonly state: DocumentRequestState
  readonly status: TimelineStatus
  /** When this step happened; null while it has not. */
  readonly at: string | null
}

/** The timestamps each state owns, as the guard trigger requires them. */
export interface RequestTimestamps {
  readonly createdAt: string
  readonly submittedAt: string | null
  readonly reviewStartedAt: string | null
  readonly readyAt: string | null
}

export function requestTimeline(
  state: DocumentRequestState,
  timestamps: RequestTimestamps,
): readonly TimelineStep[] {
  const reached = REQUEST_PROGRESSION.indexOf(state)
  const at: Record<DocumentRequestState, string | null> = {
    draft: timestamps.createdAt,
    submitted: timestamps.submittedAt,
    in_review: timestamps.reviewStartedAt,
    ready_for_issue: timestamps.readyAt,
  }

  return REQUEST_PROGRESSION.map((step, index) => ({
    state: step,
    status: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
    // A past step with no timestamp is possible only if a row was written
    // outside the functions; showing null is more honest than inventing a
    // moment for it.
    at: index <= reached ? at[step] : null,
  }))
}
