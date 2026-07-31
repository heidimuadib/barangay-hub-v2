import 'server-only'

import { AuthorizationError, BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'

import * as repo from '../repositories/registry-repository'
import type { RegistryFailure, RpcOutcome } from '../repositories/registry-repository'

// Barrel-facing re-exports (feature-index may not import repositories or
// rules directly — the service layer, which may, is where they surface).
export type { RegistryFailure, RpcOutcome } from '../repositories/registry-repository'
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
 * Translates registry RPC failures into the application's error vocabulary.
 *
 * Uniform on purpose: not-found, wrong-tenant and not-eligible collapse into
 * the same user-facing messages the database already keeps
 * indistinguishable (Phase 4 §13.6; ADR-0006 anti-enumeration posture).
 * The Server Action layer (subparts 2B–2E) adds the AUDITED requirePermission
 * gate in front of staff mutations; the database re-checks either way.
 */
export function throwRegistryFailure(failure: RegistryFailure): never {
  switch (failure) {
    case 'denied':
      throw new AuthorizationError('You do not have permission to do that.')
    case 'not-eligible':
      throw new NotFoundError('That record could not be found.')
    case 'person-superseded':
      throw new ConflictError('This record was superseded.', 'superseded')
    case 'already-open':
      throw new ConflictError('An open application already exists.', 'open')
    case 'illegal-transition':
      throw new ConflictError('That step is not available for this application.', 'state')
    case 'application-not-editable':
      throw new ConflictError('This application can no longer be edited.', 'state')
    case 'reason-required':
      throw new BusinessRuleError('BR-REG-1', 'A reason is required for this action.')
    case 'evidence-incomplete':
      throw new BusinessRuleError(
        'BR-REG-2',
        'Add at least one identity document and one proof of residency before submitting.',
      )
    case 'supersede-blocked-open-application':
      throw new BusinessRuleError(
        'BR-REG-3',
        'Decide the open verification application on this record before resolving the duplicate.',
      )
    case 'supersede-blocked-two-accounts':
      throw new BusinessRuleError(
        'BR-REG-4',
        'Both records have linked accounts. Unlink one deliberately before resolving the duplicate.',
      )
    case 'membership-disabled':
      throw new BusinessRuleError(
        'BR-REG-5',
        'This resident’s membership was disabled. Resolve the membership status before approving.',
      )
  }
}

/** Unwraps an outcome or throws the mapped AppError. */
export function unwrap<T>(outcome: RpcOutcome<T>, operation: string): T {
  if (outcome.ok) return outcome.data
  logger.warn('Registry operation refused', { operation, failure: outcome.failure })
  throwRegistryFailure(outcome.failure)
}

// ── Thin, typed service surface consumed by subparts 2B–2E ──────────────────

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
