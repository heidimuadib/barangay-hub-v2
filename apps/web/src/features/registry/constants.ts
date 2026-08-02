/**
 * Slice 2 capability keys, exactly as approved in ADR-0006 §D2-04. The
 * database rows (migration 20260802020000) are authoritative; these constants
 * keep application code typo-proof.
 */
export const REGISTRY_PERMISSIONS = {
  registryRead: 'registry.read',
  createWalkIn: 'registry.create_walk_in',
  matchAccount: 'registry.match_account',
  resolveDuplicates: 'registry.resolve_duplicates',
  verificationRead: 'verification.read',
  verificationReview: 'verification.review',
  requestInformation: 'verification.request_information',
  approve: 'verification.approve',
  reject: 'verification.reject',
  evidenceRead: 'verification.evidence.read',
} as const

export type RegistryPermissionKey = (typeof REGISTRY_PERMISSIONS)[keyof typeof REGISTRY_PERMISSIONS]

/** D2-03: MIME allow-list, mirrored from the database CHECK. */
export const EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

/** D2-03: 10 MiB ceiling, mirrored from the database CHECK and bucket config. */
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024

// ── Evidence vocabulary and its presentation (Slice 2F) ─────────────────────
// These live beside the constants they describe rather than in `rules/`,
// because the upload UI needs them and a feature component may import
// feature-const but not feature-rule (Phase 6 §16.1). The domain DECISIONS —
// what counts as complete, what the server accepts — stay in rules/evidence.

/** Extensions offered to the file picker, aligned with the MIME allow-list. */
export const EVIDENCE_FILE_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.pdf'

/** Generic, placeholder-safe category names — never a document catalog. */
export const EVIDENCE_KIND_LABELS = {
  identity: 'Identity evidence',
  residency: 'Proof of residency',
  supporting: 'Supporting document',
} as const

/** Human-safe file labels. The original filename is never shown or stored. */
export const EVIDENCE_MIME_LABELS: Record<string, string> = {
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/webp': 'WebP image',
  'application/pdf': 'PDF document',
}

export type EvidenceRejection = 'empty' | 'too-large' | 'unsupported-type'

/**
 * Convenience screening for the browser: catches an empty or oversized file
 * before it is uploaded. The browser's reported MIME type is a hint, not a
 * fact — the bucket's `allowed_mime_types`, the table CHECK and the server
 * all decide independently.
 */
export function screenEvidenceFile(file: { size: number; type: string }): EvidenceRejection | null {
  if (file.size < 1) return 'empty'
  if (file.size > EVIDENCE_MAX_BYTES) return 'too-large'
  if (!(EVIDENCE_MIME_TYPES as readonly string[]).includes(file.type)) return 'unsupported-type'
  return null
}

export function evidenceKindLabel(kind: keyof typeof EVIDENCE_KIND_LABELS): string {
  return EVIDENCE_KIND_LABELS[kind]
}

export function evidenceMimeLabel(mimeType: string): string {
  return EVIDENCE_MIME_LABELS[mimeType] ?? 'File'
}

/** Byte size for display. Deliberately coarse — precision serves nobody here. */
export function formatEvidenceSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * D2-01 (ADR-0006): the residency vocabulary. The database enum and catalog
 * are authoritative; this mirror powers validation and labels.
 */
export const RESIDENCY_BASES = {
  property_owner: { label: 'Property owner', requiresExplanation: false },
  renter: { label: 'Renter', requiresExplanation: false },
  household_member: { label: 'Household member', requiresExplanation: false },
  caretaker: { label: 'Caretaker', requiresExplanation: false },
  informal_resident: { label: 'Informal resident', requiresExplanation: false },
  other: { label: 'Other (explain)', requiresExplanation: true },
} as const

export type ResidencyBasisConstantKey = keyof typeof RESIDENCY_BASES
