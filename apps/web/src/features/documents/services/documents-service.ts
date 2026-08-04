import 'server-only'

import * as repo from '../repositories/documents-repository'

/**
 * Barrel-facing surface for the documents domain.
 *
 * Neither the feature barrel nor the action layer may import repositories or
 * rules directly (Phase 6 §16.1), so the service layer — which may — is where
 * they surface. Mirrors `registry-service.ts` deliberately: two features that
 * solve the same problem differently is a cost paid on every future read.
 */
export type { DocumentFailure, RpcOutcome } from '../repositories/documents-repository'
export { throwDocumentFailure, unwrap } from '../repositories/documents-repository'

export {
  CONFIRMED,
  PROVISIONAL,
  UNDECIDED,
  formatFee,
  formatSla,
  formatValidity,
  presentTerms,
  requiresPlaceholderNotice,
  termStatus,
  type PresentedTerms,
  type TermStatus,
} from '../rules/catalog-terms'

export {
  REQUEST_TRANSITIONS,
  SLICE3_FINAL_STATES,
  availableRequestActions,
  canSubmit,
  canTransition,
  isActionableByStaff,
  isEditable,
  isFinalForSlice3,
  missingRequirementKeys,
  requesterNextStep,
  type RequesterNextStep,
} from '../rules/request-transitions'

export {
  canRequestDocuments,
  eligibilityNextRoute,
  requestEligibility,
  type RequestEligibility,
} from '../rules/resident-eligibility'

export {
  REQUEST_PROGRESSION,
  requestTimeline,
  type RequestTimestamps,
  type TimelineStatus,
  type TimelineStep,
} from '../rules/request-timeline'

/**
 * Thin, typed surface over the 3A domain functions. Each RPC re-checks
 * ownership or capability inside the database, so this layer moves data and
 * nothing more.
 */
export const documentsService = {
  createOwnRequest: repo.createOwnRequest,
  setRequestAnswer: repo.setRequestAnswer,
  submitRequest: repo.submitRequest,
} as const
