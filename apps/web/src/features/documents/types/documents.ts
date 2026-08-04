import type { Database } from '@barangay-hub/supabase/types'

/** The request lifecycle, straight from the database enum. */
export type DocumentRequestState = Database['public']['Enums']['document_request_state']

/** Which door the request came through (roadmap Slice 3 §4). */
export type RequestSource = Database['public']['Enums']['request_source']

/** The shape of a per-document-type requirement input. */
export type RequirementInputKind = Database['public']['Enums']['requirement_input_kind']

export type DocumentTypeRow = Database['public']['Tables']['document_types']['Row']
export type DocumentTypeRequirementRow =
  Database['public']['Tables']['document_type_requirements']['Row']
export type DocumentRequestRow = Database['public']['Tables']['document_requests']['Row']

/**
 * The commercial terms of a document type.
 *
 * Modelled as its own type because these four fields travel together and are
 * meaningless apart: an amount without the placeholder flag is exactly the
 * misreading blocker B-08 exists to prevent.
 */
export interface CatalogTerms {
  readonly feeAmount: number | null
  readonly feeCurrency: string
  readonly slaDays: number | null
  readonly validityDays: number | null
  readonly valuesArePlaceholder: boolean
}

/** What a reviewer is allowed to do, resolved from their capabilities. */
export interface RequestReviewerCapabilities {
  readonly canReview: boolean
  readonly canMarkReady: boolean
}

/** Controls the staff request detail may offer. */
export type RequestActionKey = 'start_review' | 'mark_ready'

// ── Resident-facing view models (Slice 3B) ──────────────────────────────────
// Shaped for the screen rather than mirroring table rows: every one of these
// drops `barangay_id` and the staff-only columns, so a resident surface cannot
// render a field it was never meant to see.

/** One catalog row as the resident sees it. */
export interface CatalogEntry {
  readonly documentTypeId: string
  readonly code: string
  readonly name: string
  readonly description: string | null
  readonly terms: CatalogTerms
  readonly requiresSupportingEvidence: boolean
  readonly requirementCount: number
}

/** One requirement, carrying exactly what a form control needs. */
export interface RequirementField {
  readonly requirementId: string
  readonly key: string
  readonly label: string
  readonly helpText: string | null
  readonly inputKind: RequirementInputKind
  readonly isRequired: boolean
  /** Non-empty only for `select`; the trigger enforces that pairing. */
  readonly options: readonly string[]
}

export interface DocumentTypeDetail {
  readonly entry: CatalogEntry
  readonly requirements: readonly RequirementField[]
}

/** One row of the resident's own request list. */
export interface OwnRequestSummary {
  readonly requestId: string
  readonly state: DocumentRequestState
  /** Null when the type is no longer readable — never a blank-looking name. */
  readonly documentTypeName: string | null
  readonly createdAt: string
  readonly submittedAt: string | null
}

/** One answered requirement on the request detail. */
export interface RequestAnswerView {
  readonly requirementId: string
  readonly key: string
  readonly label: string
  readonly value: string
}

export interface OwnRequestDetail {
  readonly requestId: string
  readonly state: DocumentRequestState
  readonly purpose: string
  readonly createdAt: string
  readonly submittedAt: string | null
  readonly reviewStartedAt: string | null
  readonly readyAt: string | null
  readonly documentType: CatalogEntry
  readonly requirements: readonly RequirementField[]
  readonly answers: readonly RequestAnswerView[]
}

/** Verification standing, straight from the Slice 2 enum. */
export type VerificationState = Database['public']['Enums']['verification_state']

/** How the PERSON reached the registry — distinct from `RequestSource`. */
export type PersonSource = Database['public']['Enums']['person_source']

// ── Staff-facing view models (Slice 3C) ─────────────────────────────────────
// These carry what counter work needs and what the resident views omit:
// who the requester is, which door the request came through, and why staff
// filed it. They are deliberately separate types from the resident ones, so a
// resident surface cannot render a staff field by reaching for the wrong
// model.

/** One row of the staff intake queue. */
export interface RequestQueueEntry {
  readonly requestId: string
  readonly state: DocumentRequestState
  /** Null when the type is no longer readable — never a blank-looking name. */
  readonly documentTypeName: string | null
  /**
   * Null when the caller holds `requests.read` but not `registry.read`.
   * Stated rather than faked: a queue that invents "Unknown" would hide a
   * capability-mapping mistake behind plausible-looking data.
   */
  readonly requesterName: string | null
  readonly sourceChannel: RequestSource
  /** False for a walk-in with no online account (ADR-0006 point 16). */
  readonly hasAccount: boolean
  readonly submittedAt: string | null
  readonly createdAt: string
}

/** Everything the staff request detail shows. */
export interface StaffRequestDetail {
  readonly requestId: string
  readonly state: DocumentRequestState
  readonly purpose: string
  readonly createdAt: string
  readonly submittedAt: string | null
  readonly reviewStartedAt: string | null
  readonly readyAt: string | null
  /** Provenance — immutable, and the whole point of the two channels. */
  readonly sourceChannel: RequestSource
  /** Required for the assisted channel, null for self-service. */
  readonly creationReason: string | null
  readonly documentType: CatalogEntry
  readonly requirements: readonly RequirementField[]
  readonly answers: readonly RequestAnswerView[]
  /** Null on the same capability-mapping condition as the queue's name. */
  readonly requester: {
    readonly personId: string
    readonly fullName: string
    readonly personSource: PersonSource
    readonly hasAccount: boolean
  } | null
}

/**
 * Where the caller stands as a resident of ONE barangay.
 *
 * Both fields are independently absent: no person means they never onboarded,
 * and a person with no application is mid-onboarding. The two are different
 * problems with different next steps, so they are not collapsed into a
 * boolean here — `rules/resident-eligibility.ts` does that once, explainably.
 */
export interface ResidentStanding {
  readonly personId: string | null
  readonly verificationState: VerificationState | null
}
