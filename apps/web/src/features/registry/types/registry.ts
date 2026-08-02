// Self-contained: feature type modules import nothing (boundaries default-deny).

export type ResidencyBasisKey =
  'property_owner' | 'renter' | 'household_member' | 'caretaker' | 'informal_resident' | 'other'

export type PersonSource = 'self' | 'staff'

export type VerificationState =
  'draft' | 'submitted' | 'in_review' | 'info_requested' | 'resubmitted' | 'approved' | 'rejected'

export type EvidenceKind = 'identity' | 'residency' | 'supporting'

export interface DuplicateCandidate {
  readonly personId: string
  readonly firstName: string
  readonly lastName: string
  readonly birthdate: string | null
  readonly nameSimilarity: number
  readonly sameBirthdate: boolean
  readonly hasAccount: boolean
}

/** One row of the staff registry list or detail view (Slice 2C). */
export interface RegistryEntry {
  readonly personId: string
  readonly fullName: string
  readonly birthdate: string | null
  readonly residencyBasisKey: ResidencyBasisKey
  readonly sourceChannel: PersonSource
  readonly superseded: boolean
  readonly hasAccount: boolean
  readonly verificationState: string | null
}

/** The reviewer controls the detail page may offer (Slice 2D). */
export type ReviewActionKey = 'start_review' | 'request_information' | 'approve' | 'reject'

/** Safe name-similarity explanation bands (Slice 2E) — never raw decimals. */
export type SimilarityBand = 'near_identical' | 'strong' | 'possible'

/**
 * One side-by-side duplicate candidate on the review surface (Slice 2E):
 * the minimum a resolver needs to decide, plus WHY it was flagged. Names and
 * birthdates are signals only, never identity proof (ADR-0006 points 9–10).
 */
export interface DuplicateComparisonRow {
  readonly personId: string
  readonly fullName: string
  readonly birthdate: string | null
  readonly residencyBasisKey: ResidencyBasisKey
  readonly sourceChannel: PersonSource
  readonly hasAccount: boolean
  readonly verificationState: string | null
  readonly similarityBand: SimilarityBand
  readonly sameBirthdate: boolean
}

/** The D2-04 capability split as booleans the caller actually holds. */
export interface ReviewerCapabilities {
  readonly canReview: boolean
  readonly canRequestInformation: boolean
  readonly canApprove: boolean
  readonly canReject: boolean
}

/** One row of the staff verification queue (Slice 2D). */
export interface VerificationQueueEntry {
  readonly applicationId: string
  readonly personId: string
  readonly fullName: string
  readonly state: VerificationState
  readonly submittedAt: string | null
  readonly createdAt: string
  readonly sourceChannel: PersonSource
  readonly hasAccount: boolean
}

/**
 * One evidence item as the RESIDENT sees it (Slice 2F). Carries no storage
 * path and no signed URL — both are server-side concerns, requested on
 * demand and never rendered into the page.
 */
export interface EvidenceItem {
  readonly evidenceId: string
  readonly kind: EvidenceKind
  readonly mimeType: string
  readonly declaredSizeBytes: number
  /** Trusted size, read from the stored object at finalization. */
  readonly sizeBytes: number | null
  /** Non-null once the object was verified to exist — i.e. finalized. */
  readonly uploadedAt: string | null
  readonly createdAt: string
}

/** Whether the minimum-evidence rule is satisfied (mirrors the SQL). */
export interface EvidenceReadiness {
  readonly hasIdentity: boolean
  readonly hasResidency: boolean
  readonly pendingCount: number
  readonly canSubmit: boolean
}

/**
 * A one-object, short-lived upload authorization (Slice 2F).
 *
 * The browser receives a complete signed URL and nothing else — no bucket
 * name to reason about, no path to reconstruct, and no Supabase client (which
 * would pull the server environment schema into the client bundle).
 */
export interface EvidenceUploadTicket {
  readonly evidenceId: string
  readonly signedUrl: string
}

/** Evidence METADATA for the review detail — never file contents (2F). */
export interface EvidenceSummary {
  readonly evidenceId: string
  readonly kind: EvidenceKind
  readonly mimeType: string
  readonly declaredSizeBytes: number
  readonly sizeBytes: number | null
  readonly uploadedAt: string | null
  readonly createdAt: string
}

/** Everything the review detail shows about one application (Slice 2D). */
export interface ApplicationDetail {
  readonly applicationId: string
  readonly state: VerificationState
  readonly createdAt: string
  readonly submittedAt: string | null
  readonly decidedAt: string | null
  readonly infoRequestNote: string | null
  readonly decisionReason: string | null
  readonly person: {
    readonly personId: string
    readonly fullName: string
    readonly birthdate: string | null
    readonly contactPhone: string | null
    readonly addressLine: string | null
    readonly residencyBasisKey: ResidencyBasisKey
    readonly residencyExplanation: string | null
    readonly sourceChannel: PersonSource
    readonly superseded: boolean
    readonly hasAccount: boolean
  }
  /** `null` means the caller lacks `verification.evidence.read` — distinct from "no documents yet". */
  readonly evidence: readonly EvidenceSummary[] | null
  /** Context only — resolution is Slice 2E behind `registry.resolve_duplicates`. */
  readonly duplicates: readonly DuplicateCandidate[]
}

/** A minimal cross-link between a survivor and a superseded record. */
export interface PersonLink {
  readonly personId: string
  readonly fullName: string
}

/** Everything the duplicate review panel needs for one person (Slice 2E). */
export interface DuplicateReview {
  readonly entry: RegistryEntry
  /** Set when THIS record was superseded — who absorbed it. */
  readonly supersededBy: PersonLink | null
  /** Records superseded INTO this one, oldest first. */
  readonly absorbed: readonly PersonLink[]
  /** Side-by-side candidates, strongest signal first. */
  readonly candidates: readonly DuplicateComparisonRow[]
}

export interface PersonSearchHit {
  readonly personId: string
  readonly firstName: string
  readonly middleName: string | null
  readonly lastName: string
  readonly birthdate: string | null
  readonly residencyBasisKey: ResidencyBasisKey
  readonly sourceChannel: PersonSource
  readonly superseded: boolean
  readonly hasAccount: boolean
  readonly rank: number
}
