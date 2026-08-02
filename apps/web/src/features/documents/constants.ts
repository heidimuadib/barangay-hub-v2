/**
 * Slice 3 capability keys, exactly as seeded by migration 20260806020000.
 * The database rows are authoritative; these constants keep application code
 * typo-proof.
 */
export const DOCUMENT_PERMISSIONS = {
  catalogRead: 'documents.catalog.read',
  catalogManage: 'documents.catalog.manage',
  requestsRead: 'requests.read',
  createWalkIn: 'requests.create_walk_in',
  review: 'requests.review',
  markReady: 'requests.mark_ready',
} as const

export type DocumentPermissionKey = (typeof DOCUMENT_PERMISSIONS)[keyof typeof DOCUMENT_PERMISSIONS]

/**
 * Blocker B-08 — the fee schedule, turnaround times and validity periods are
 * NOT confirmed by any barangay. Rendered wherever a placeholder value is
 * shown, so the interface never implies a number is official.
 *
 * Wording lives here rather than in each component so the honesty rule reads
 * identically on every surface (Phase 6 §2.7 / placeholder register RES-06).
 */
export const PLACEHOLDER_NOTICE = 'Not yet confirmed'

export const PLACEHOLDER_EXPLANATION =
  'This barangay has not confirmed its fees, processing times or validity periods yet. ' +
  'Treat these figures as provisional — the office will tell you the actual amount.'

/** The register entry these values are blocked on. */
export const PLACEHOLDER_BLOCKER = 'B-08'
