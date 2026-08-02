/**
 * Registry feature — public surface through subpart 2C.
 *
 * 2A domain foundation (rules, schemas, capability constants and the typed
 * service over the database RPCs), 2B resident onboarding and verification
 * status, and 2C the staff registry, search and walk-in creation.
 * Verification decisions (2D), duplicate resolution (2E) and the evidence
 * Storage broker (2F) arrive with their subparts.
 */
export {
  EVIDENCE_FILE_EXTENSIONS,
  EVIDENCE_KIND_LABELS,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME_LABELS,
  EVIDENCE_MIME_TYPES,
  REGISTRY_PERMISSIONS,
  evidenceKindLabel,
  evidenceMimeLabel,
  formatEvidenceSize,
  screenEvidenceFile,
  type EvidenceRejection,
  type RegistryPermissionKey,
} from './constants'

export type {
  ApplicationDetail,
  DuplicateCandidate,
  DuplicateComparisonRow,
  DuplicateReview,
  EvidenceItem,
  EvidenceKind,
  EvidenceReadiness,
  EvidenceSummary,
  EvidenceUploadTicket,
  PersonLink,
  PersonSearchHit,
  PersonSource,
  RegistryEntry,
  ResidencyBasisKey,
  SimilarityBand,
  VerificationQueueEntry,
  VerificationState,
} from './types/registry'

export {
  DUPLICATE_SIMILARITY_THRESHOLD,
  RESIDENCY_BASES,
  RESIDENCY_BASIS_KEYS,
  TERMINAL_STATES,
  VERIFICATION_TRANSITIONS,
  availableReviewActions,
  candidatePriority,
  canTransition,
  evidenceReadiness,
  isActionableByStaff,
  isAllowedEvidenceMime,
  isCandidateScore,
  isDecisionAction,
  isEditable,
  isResidencyValid,
  isTerminal,
  normalizeName,
  registryService,
  requiresExplanation,
  requiresReason,
  residentNextStep,
  similarityBand,
  throwRegistryFailure,
  unwrap,
  type RegistryFailure,
  type ResidentNextStep,
  type ReviewActionKey,
  type ReviewerCapabilities,
  type RpcOutcome,
} from './services/registry-service'

export {
  EVIDENCE_KINDS,
  VERIFICATION_STATE_KEYS,
  evidenceFinalizeSchema,
  evidenceMetadataSchema,
  evidenceReadSchema,
  evidenceRemoveSchema,
  evidenceUploadRequestSchema,
  submitApplicationSchema,
  personDetailsSchema,
  queueFilterSchema,
  rejectSchema,
  requestInformationSchema,
  resubmitSchema,
  reviewActionSchema,
  supersedeSchema,
  walkInCreateSchema,
} from './schemas/registry.schema'

export {
  getBarangayDirectory,
  getOwnRegistryState,
  type BarangayDirectoryEntry,
  type OwnRegistryRow,
} from './services/onboarding-service'

export {
  REGISTRY_PAGE_SIZE,
  createWalkIn,
  findDuplicateCandidates,
  getDuplicateReview,
  getPersonDetail,
  listRegistry,
  resolveDuplicateBySupersede,
  searchRegistry,
  type RegistryPageResult,
} from './services/staff-registry-service'

export {
  QUEUE_PAGE_SIZE,
  getApplicationDetail,
  listVerificationQueue,
  type VerificationQueuePage,
} from './services/verification-service'

export {
  canReadEvidence,
  listOwnEvidence,
  requestEvidenceReadUrl,
} from './services/evidence-service'

export {
  finalizeEvidenceAction,
  prepareEvidenceUploadAction,
  removeEvidenceAction,
  requestEvidenceUrlAction,
  submitApplicationAction,
} from './actions/evidence'
export { completeOnboardingAction } from './actions/onboarding'
export { resolveDuplicateAction, type ResolveDuplicateResult } from './actions/resolve-duplicate'
export { createWalkInAction, searchRegistryAction, type WalkInOutcome } from './actions/walk-in'
export {
  approveApplicationAction,
  rejectApplicationAction,
  requestInformationAction,
  resubmitApplicationAction,
  startReviewAction,
  type VerificationActionResult,
} from './actions/verification'

export { DuplicateResolutionPanel } from './components/duplicate-resolution'
export { EvidenceManager } from './components/evidence-manager'
export { EvidenceViewButton } from './components/evidence-viewer'
export { OnboardingForm } from './components/onboarding-form'
export { RegistrySearch } from './components/registry-search'
export { RegistryRows, RegistryTable } from './components/registry-table'
export { ResubmissionForm } from './components/resubmission-form'
export { ReviewActions } from './components/review-actions'
export { QueueFilters, QueueStateChip, VerificationQueue } from './components/verification-queue'
export { WalkInForm } from './components/walk-in-form'
export { VerificationStatusBadge, VerificationStatusPanel } from './components/verification-status'
