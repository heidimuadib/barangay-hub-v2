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
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME_TYPES,
  REGISTRY_PERMISSIONS,
  type RegistryPermissionKey,
} from './constants'

export type {
  ApplicationDetail,
  DuplicateCandidate,
  EvidenceKind,
  EvidenceSummary,
  PersonSearchHit,
  PersonSource,
  RegistryEntry,
  ResidencyBasisKey,
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
  isActionableByStaff,
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
  throwRegistryFailure,
  unwrap,
  type RegistryFailure,
  type ResidentNextStep,
  type ReviewActionKey,
  type ReviewerCapabilities,
  type RpcOutcome,
} from './services/registry-service'

export {
  VERIFICATION_STATE_KEYS,
  evidenceMetadataSchema,
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
  getPersonDetail,
  listRegistry,
  searchRegistry,
  type RegistryPageResult,
} from './services/staff-registry-service'

export {
  QUEUE_PAGE_SIZE,
  getApplicationDetail,
  listVerificationQueue,
  type VerificationQueuePage,
} from './services/verification-service'

export { completeOnboardingAction } from './actions/onboarding'
export { createWalkInAction, searchRegistryAction, type WalkInOutcome } from './actions/walk-in'
export {
  approveApplicationAction,
  rejectApplicationAction,
  requestInformationAction,
  resubmitApplicationAction,
  startReviewAction,
  type VerificationActionResult,
} from './actions/verification'

export { OnboardingForm } from './components/onboarding-form'
export { RegistrySearch } from './components/registry-search'
export { RegistryRows, RegistryTable } from './components/registry-table'
export { ResubmissionForm } from './components/resubmission-form'
export { ReviewActions } from './components/review-actions'
export { QueueFilters, QueueStateChip, VerificationQueue } from './components/verification-queue'
export { WalkInForm } from './components/walk-in-form'
export { VerificationStatusBadge, VerificationStatusPanel } from './components/verification-status'
