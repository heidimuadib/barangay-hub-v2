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
  DuplicateCandidate,
  EvidenceKind,
  PersonSearchHit,
  PersonSource,
  RegistryEntry,
  ResidencyBasisKey,
  VerificationState,
} from './types/registry'

export {
  DUPLICATE_SIMILARITY_THRESHOLD,
  RESIDENCY_BASES,
  RESIDENCY_BASIS_KEYS,
  TERMINAL_STATES,
  VERIFICATION_TRANSITIONS,
  candidatePriority,
  canTransition,
  isActionableByStaff,
  isCandidateScore,
  isEditable,
  isResidencyValid,
  isTerminal,
  normalizeName,
  registryService,
  requiresExplanation,
  requiresReason,
  throwRegistryFailure,
  unwrap,
  type RegistryFailure,
  type RpcOutcome,
} from './services/registry-service'

export {
  evidenceMetadataSchema,
  personDetailsSchema,
  rejectSchema,
  requestInformationSchema,
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

export { completeOnboardingAction } from './actions/onboarding'
export { createWalkInAction, searchRegistryAction, type WalkInOutcome } from './actions/walk-in'

export { OnboardingForm } from './components/onboarding-form'
export { RegistrySearch } from './components/registry-search'
export { RegistryRows, RegistryTable } from './components/registry-table'
export { WalkInForm } from './components/walk-in-form'
export { VerificationStatusBadge, VerificationStatusPanel } from './components/verification-status'
