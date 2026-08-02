/**
 * Public barrel for the documents feature (Slice 3A — domain foundation).
 *
 * Only rules, schemas, types and constants so far: 3A ships the domain and
 * its proofs, and the resident/staff surfaces arrive in 3B/3C. Cross-feature
 * imports must come through this file (Phase 6 §16.2).
 */
export {
  DOCUMENT_PERMISSIONS,
  PLACEHOLDER_BLOCKER,
  PLACEHOLDER_EXPLANATION,
  PLACEHOLDER_NOTICE,
} from './constants'
export type { DocumentPermissionKey } from './constants'

export type {
  CatalogTerms,
  DocumentRequestRow,
  DocumentRequestState,
  DocumentTypeRequirementRow,
  DocumentTypeRow,
  RequestActionKey,
  RequestReviewerCapabilities,
  RequestSource,
  RequirementInputKind,
} from './types/documents'
