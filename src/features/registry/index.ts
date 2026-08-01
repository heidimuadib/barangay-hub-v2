/**
 * Registry feature — Slice 2A public surface.
 *
 * Domain foundation only: rules, schemas, capability constants and the typed
 * service over the database RPCs. Actions and components arrive with
 * subparts 2B–2E.
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

export { completeOnboardingAction } from './actions/onboarding'

export { OnboardingForm } from './components/onboarding-form'
export { VerificationStatusBadge, VerificationStatusPanel } from './components/verification-status'
