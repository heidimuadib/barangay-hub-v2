import 'server-only'

import * as repo from '../repositories/registry-repository'

// Barrel-facing re-exports. Neither the feature barrel nor the action layer
// may import repositories or rules directly (Phase 6 §16.1), so the service
// layer — which may — is where they surface.
export type { RegistryFailure, RpcOutcome } from '../repositories/registry-repository'
export { throwRegistryFailure, unwrap } from '../repositories/registry-repository'
export {
  TERMINAL_STATES,
  VERIFICATION_TRANSITIONS,
  canTransition,
  isActionableByStaff,
  isEditable,
  isTerminal,
  requiresReason,
} from '../rules/verification-transitions'
export {
  DUPLICATE_SIMILARITY_THRESHOLD,
  candidatePriority,
  isCandidateScore,
  normalizeName,
} from '../rules/duplicate-scoring'
export {
  RESIDENCY_BASES,
  RESIDENCY_BASIS_KEYS,
  isResidencyValid,
  requiresExplanation,
} from '../rules/residency'

/**
 * Thin, typed surface over the Slice 2 domain functions. Each RPC re-checks
 * capability or ownership inside the database, so this layer moves data and
 * nothing more; the audited guard lives in the calling service or action.
 */
export const registryService = {
  createOwnPerson: repo.createOwnPerson,
  createWalkInPerson: repo.createWalkInPerson,
  searchPersons: repo.searchPersons,
  duplicateCandidates: repo.fetchDuplicateCandidates,
  supersedePerson: repo.supersedePerson,
  linkPersonAccount: repo.linkPersonAccount,
  unlinkPersonAccount: repo.unlinkPersonAccount,
  createVerificationApplication: repo.createVerificationApplication,
  submitVerification: repo.submitVerification,
  reviewVerification: repo.reviewVerification,
  requestInformation: repo.requestInformation,
  resubmitVerification: repo.resubmitVerification,
  approveVerification: repo.approveVerification,
  rejectVerification: repo.rejectVerification,
  addEvidenceMetadata: repo.addEvidenceMetadata,
  confirmEvidenceUpload: repo.confirmEvidenceUpload,
  removeEvidence: repo.removeEvidence,
} as const
