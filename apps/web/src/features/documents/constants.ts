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
  /** Slice 3D, seeded by migration 20260808010000. */
  evidenceRead: 'requests.evidence.read',
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

/**
 * Namespace for requirement answers inside the request form's FormData.
 *
 * Requirement keys are authored by each barangay, so one could legitimately be
 * called `purpose` and collide with the request's own field. The `.` is not
 * permitted by the key CHECK, which makes the prefix collision-proof rather
 * than merely unlikely.
 */
export const ANSWER_FIELD_PREFIX = 'answer.'

// ── Supporting-evidence vocabulary (Slice 3D) ───────────────────────────────
// Beside the constants they describe rather than in `rules/`, because the
// upload component needs them and a feature component may import feature-const
// but not feature-rule (Phase 6 §16.1). The domain DECISIONS — what counts as
// complete, what the server accepts — stay in rules/request-evidence.
//
// Identical values to Slice 2F's, and deliberately so: the same bucket limits,
// the same allow-list, the same ceiling. Two different answers to "what may a
// resident upload" would be a bug waiting for someone to find it.

export const REQUEST_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

/** 10 MiB, mirrored from the database CHECK and the bucket configuration. */
export const REQUEST_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024

/** Extensions offered to the file picker, aligned with the MIME allow-list. */
export const REQUEST_EVIDENCE_FILE_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.pdf'

/** Human-safe file labels. The original filename is never shown or stored. */
const REQUEST_EVIDENCE_MIME_LABELS: Record<string, string> = {
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/webp': 'WebP image',
  'application/pdf': 'PDF document',
}

export type RequestEvidenceRejection = 'empty' | 'too-large' | 'unsupported-type'

/**
 * Browser-side convenience screening, so an obviously wrong file is refused
 * before it is uploaded. NOT a security boundary — the bucket, the column
 * CHECK and the finalization all refuse independently.
 */
export function screenRequestEvidenceFile(file: {
  size: number
  type: string
}): RequestEvidenceRejection | null {
  if (file.size < 1) return 'empty'
  if (file.size > REQUEST_EVIDENCE_MAX_BYTES) return 'too-large'
  if (!(REQUEST_EVIDENCE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'unsupported-type'
  }
  return null
}

export function requestEvidenceMimeLabel(mimeType: string): string {
  return REQUEST_EVIDENCE_MIME_LABELS[mimeType] ?? 'File'
}

/** Byte size for display. Deliberately coarse — precision serves nobody here. */
export function formatRequestEvidenceSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
