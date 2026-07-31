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
