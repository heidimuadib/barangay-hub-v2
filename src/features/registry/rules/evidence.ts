import { EVIDENCE_MIME_TYPES } from '../constants'
import type { EvidenceItem, EvidenceReadiness } from '../types/registry'

/**
 * Evidence DECISIONS (Slice 2F; D2-03).
 *
 * Pure and I/O-free. The vocabulary these operate over — the MIME allow-list,
 * the size ceiling, the category labels and the browser's convenience
 * screening — lives in `../constants`, because the upload component needs it
 * and may not import a rule module (Phase 6 §16.1).
 *
 * The DATABASE remains the authority: the MIME CHECK, the size CHECK and
 * `submit_verification`'s finalized-evidence rule all re-decide independently.
 * Nothing here is a security boundary.
 */

export function isAllowedEvidenceMime(mimeType: string): boolean {
  return (EVIDENCE_MIME_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Submission readiness, mirroring `submit_verification`'s tightened rule:
 * one FINALIZED identity item and one FINALIZED residency item. A pending
 * upload is an intention, not a document, and never counts.
 */
export function evidenceReadiness(items: readonly EvidenceItem[]): EvidenceReadiness {
  const finalized = items.filter((item) => item.uploadedAt !== null)
  const hasIdentity = finalized.some((item) => item.kind === 'identity')
  const hasResidency = finalized.some((item) => item.kind === 'residency')
  return {
    hasIdentity,
    hasResidency,
    pendingCount: items.length - finalized.length,
    canSubmit: hasIdentity && hasResidency,
  }
}
