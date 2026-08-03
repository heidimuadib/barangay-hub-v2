/**
 * Public barrel for the documents feature (Slice 3A domain + 3B resident
 * surfaces).
 *
 * 3A shipped rules, schemas, types and constants; 3B adds the catalog and
 * request-intake services, the resident actions and the components the
 * resident routes render. The staff intake queue (3C) and supporting evidence
 * (3D) arrive with their subparts. Cross-feature imports must come through
 * this file (Phase 6 §16.2).
 */
export {
  ANSWER_FIELD_PREFIX,
  DOCUMENT_PERMISSIONS,
  PLACEHOLDER_BLOCKER,
  PLACEHOLDER_EXPLANATION,
  PLACEHOLDER_NOTICE,
} from './constants'
export type { DocumentPermissionKey } from './constants'

export type {
  CatalogEntry,
  CatalogTerms,
  DocumentRequestRow,
  DocumentRequestState,
  DocumentTypeDetail,
  DocumentTypeRequirementRow,
  DocumentTypeRow,
  OwnRequestDetail,
  OwnRequestSummary,
  RequestActionKey,
  RequestAnswerView,
  RequestReviewerCapabilities,
  RequestSource,
  RequirementField,
  RequirementInputKind,
  ResidentStanding,
  VerificationState,
} from './types/documents'

export {
  CONFIRMED,
  PROVISIONAL,
  REQUEST_PROGRESSION,
  REQUEST_TRANSITIONS,
  SLICE3_FINAL_STATES,
  UNDECIDED,
  availableRequestActions,
  canRequestDocuments,
  canSubmit,
  canTransition,
  documentsService,
  eligibilityNextRoute,
  formatFee,
  formatSla,
  formatValidity,
  isActionableByStaff,
  isEditable,
  isFinalForSlice3,
  missingRequirementKeys,
  presentTerms,
  requestEligibility,
  requestTimeline,
  requesterNextStep,
  requiresPlaceholderNotice,
  termStatus,
  throwDocumentFailure,
  unwrap,
  type DocumentFailure,
  type PresentedTerms,
  type RequestEligibility,
  type RequesterNextStep,
  type RequestTimestamps,
  type RpcOutcome,
  type TermStatus,
  type TimelineStatus,
  type TimelineStep,
} from './services/documents-service'

export { getDocumentTypeDetail, getResidentCatalog } from './services/catalog-service'
export {
  REQUESTS_PAGE_SIZE,
  getOwnRequestDetail,
  getResidentStanding,
  listOwnRequestPage,
  type OwnRequestListPage,
} from './services/request-service'

export {
  answerFieldName,
  answerSchemaFor,
  createOwnRequestSchema,
  createWalkInRequestSchema,
  documentTypeCodeSchema,
  purposeSchema,
  requestActionSchema,
  requirementKeySchema,
  validateAnswers,
  type AnswerValidation,
  type CreateOwnRequestInput,
  type CreateWalkInRequestInput,
  type RequestActionInput,
} from './schemas/documents.schema'

export {
  createRequestAction,
  saveAnswersAction,
  submitRequestAction,
  type RequestActionData,
} from './actions/requests'

export { CatalogList, type CatalogCard } from './components/catalog-list'
export { DocumentTerms, PlaceholderChip, PlaceholderNotice } from './components/document-terms'
export { EligibilityNotice } from './components/eligibility-notice'
export { AnswerForm, RequestForm } from './components/request-form'
export { RequestList, RequestStateChip } from './components/request-list'
export { RequestProgress } from './components/request-progress'
export { RequirementList } from './components/requirement-list'
export { SubmitRequest } from './components/submit-request'
