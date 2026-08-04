import { REQUEST_EVIDENCE_MIME_TYPES } from '../constants'
import type { RequestEvidenceItem } from '../types/documents'

/**
 * Supporting-evidence decisions (Slice 3D).
 *
 * Pure and I/O-free. The DATABASE remains the authority: the MIME CHECK, the
 * size CHECK, the bucket's own allow-list and `submit_request`'s
 * `EVIDENCE_REQUIRED` gate all re-decide independently. Nothing here is a
 * security boundary — it exists so a screen can explain what is missing before
 * a round trip, and so the rule is unit-testable without a database.
 */

export function isAllowedRequestEvidenceMime(mimeType: string): boolean {
  return (REQUEST_EVIDENCE_MIME_TYPES as readonly string[]).includes(mimeType)
}

export interface RequestEvidenceReadiness {
  /** Items whose object was verified to exist. Only these count. */
  readonly finalizedCount: number
  /** Reserved rows whose upload never landed. */
  readonly pendingCount: number
  /** Whether the evidence rule is satisfied for this document type. */
  readonly satisfied: boolean
}

/**
 * Mirrors `submit_request`'s evidence gate exactly.
 *
 * A PENDING item is an intention, not a document, and never counts — the same
 * tightening Slice 2F applied to `submit_verification`. A type that asks for
 * nothing is satisfied by nothing, which is why `requiresEvidence` is a
 * parameter rather than an assumption.
 */
export function requestEvidenceReadiness(
  items: readonly RequestEvidenceItem[],
  requiresEvidence: boolean,
): RequestEvidenceReadiness {
  const finalizedCount = items.filter((item) => item.uploadedAt !== null).length
  return {
    finalizedCount,
    pendingCount: items.length - finalizedCount,
    satisfied: !requiresEvidence || finalizedCount >= 1,
  }
}
