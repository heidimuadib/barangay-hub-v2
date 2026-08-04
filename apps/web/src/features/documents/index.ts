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
  REQUEST_EVIDENCE_FILE_EXTENSIONS,
  REQUEST_EVIDENCE_MAX_BYTES,
  REQUEST_EVIDENCE_MIME_TYPES,
  formatRequestEvidenceSize,
  requestEvidenceMimeLabel,
  screenRequestEvidenceFile,
  PLACEHOLDER_BLOCKER,
  PLACEHOLDER_EXPLANATION,
  PLACEHOLDER_NOTICE,
} from './constants'
export type { DocumentPermissionKey, RequestEvidenceRejection } from './constants'

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
  PersonSource,
  RequestActionKey,
  RequestQueueEntry,
  RequestAnswerView,
  RequestReviewerCapabilities,
  RequestSource,
  RequirementField,
  RequirementInputKind,
  RequestEvidenceItem,
  RequestEvidenceUploadTicket,
  ResidentStanding,
  StaffRequestDetail,
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
  getPublicBarangays,
  getPublicCatalog,
  type PublicBarangay,
} from './services/public-catalog-service'
export { canReadRequestEvidence, listRequestEvidence } from './services/request-evidence-service'
export {
  isAllowedRequestEvidenceMime,
  requestEvidenceReadiness,
  type RequestEvidenceReadiness,
} from './rules/request-evidence'
export {
  REQUEST_QUEUE_PAGE_SIZE,
  fileWalkInRequest,
  getStaffRequestDetail,
  listRequestQueue,
  markRequestReadyForIssue,
  reviewerCapabilities,
  startRequestReview,
  submitWalkInRequest,
  type RequestQueuePage,
} from './services/staff-request-service'
export {
  REQUESTS_PAGE_SIZE,
  getOwnRequestDetail,
  getResidentStanding,
  listOwnRequestPage,
  type OwnRequestListPage,
} from './services/request-service'

export {
  REQUEST_STATE_KEYS,
  answerFieldName,
  answerSchemaFor,
  requestQueueFilterSchema,
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
export {
  createWalkInRequestAction,
  markReadyAction,
  startReviewAction,
  type StaffRequestActionData,
} from './actions/staff-requests'

export { CatalogList, type CatalogCard } from './components/catalog-list'
export { DocumentTerms, PlaceholderChip, PlaceholderNotice } from './components/document-terms'
export { EligibilityNotice } from './components/eligibility-notice'
export { AnswerForm, RequestForm } from './components/request-form'
export { RequestList, RequestStateChip } from './components/request-list'
export { RequestQueue, RequestQueueChip, RequestQueueFilters } from './components/request-queue'
export { RequestEvidenceManager } from './components/request-evidence-manager'
export { RequestEvidenceViewer } from './components/request-evidence-viewer'
export { RequestReviewActions } from './components/request-review-actions'
export { WalkInRequestForm } from './components/walk-in-request-form'
export { RequestProgress } from './components/request-progress'
export { RequirementList } from './components/requirement-list'
export { SubmitRequest } from './components/submit-request'
