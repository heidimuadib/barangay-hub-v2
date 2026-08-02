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
