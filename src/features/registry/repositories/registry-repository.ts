import 'server-only'

import { AuthorizationError, BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

/**
 * RPC wrappers over the Slice 2 domain functions. Every call runs on the
 * caller's OWN session: the SECURITY DEFINER functions re-check capability or
 * ownership and RLS scopes every read — this module only moves data. Domain
 * error identifiers (ILLEGAL_TRANSITION, REASON_REQUIRED, …) are surfaced as
 * typed outcomes; the service layer maps them to AppErrors.
 */

type Rpc = Database['public']['Functions']

export type RegistryFailure =
  | 'denied'
  | 'not-eligible'
  | 'illegal-transition'
  | 'reason-required'
  | 'evidence-incomplete'
  | 'already-open'
  | 'person-superseded'
  | 'application-not-editable'
  | 'supersede-blocked-open-application'
  | 'supersede-blocked-two-accounts'
  | 'membership-disabled'

const FAILURE_BY_MESSAGE: readonly (readonly [string, RegistryFailure])[] = [
  ['AUTHORIZATION_DENIED', 'denied'],
  ['AUTHENTICATION_REQUIRED', 'denied'],
  ['ILLEGAL_TRANSITION', 'illegal-transition'],
  ['REASON_REQUIRED', 'reason-required'],
  ['NOTE_REQUIRED', 'reason-required'],
  ['EVIDENCE_INCOMPLETE', 'evidence-incomplete'],
  ['APPLICATION_ALREADY_OPEN', 'already-open'],
  ['PERSON_ALREADY_EXISTS', 'already-open'],
  ['PERSON_SUPERSEDED', 'person-superseded'],
  ['APPLICATION_NOT_EDITABLE', 'application-not-editable'],
  ['SUPERSEDE_BLOCKED_BY_OPEN_APPLICATION', 'supersede-blocked-open-application'],
  ['SUPERSEDE_BLOCKED_BY_TWO_ACCOUNTS', 'supersede-blocked-two-accounts'],
  ['MEMBERSHIP_DISABLED', 'membership-disabled'],
  ['SUPERSEDE_NOT_ELIGIBLE', 'not-eligible'],
  ['LINK_NOT_ELIGIBLE', 'not-eligible'],
  ['LINK_NOT_FOUND', 'not-eligible'],
  ['BARANGAY_NOT_AVAILABLE', 'not-eligible'],
  ['EVIDENCE_ALREADY_CONFIRMED', 'not-eligible'],
]

export function mapRegistryError(message: string): RegistryFailure | null {
  for (const [needle, failure] of FAILURE_BY_MESSAGE) {
    if (message.includes(needle)) return failure
  }
  return null
}

export type RpcOutcome<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly failure: RegistryFailure }

/**
 * Translates registry RPC failures into the application's error vocabulary.
 *
 * Uniform on purpose: not-found, wrong-tenant and not-eligible collapse into
 * the same user-facing messages the database already keeps indistinguishable
 * (Phase 4 §13.6; ADR-0006 anti-enumeration posture).
 *
 * It lives at the repository layer because BOTH service modules need it and
 * a service may not import another service (Phase 6 §16.1); repositories are
 * the lowest layer permitted to reference `lib/errors`.
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

async function callRpc<Name extends keyof Rpc>(
  name: Name,
  args: Rpc[Name]['Args'],
): Promise<RpcOutcome<Rpc[Name]['Returns']>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc(name, args)
  if (!error) {
    return { ok: true, data }
  }
  const failure = mapRegistryError(error.message)
  if (failure) {
    return { ok: false, failure }
  }
  throw new Error(`${name} failed: ${error.code}`)
}

// ── Persons ─────────────────────────────────────────────────────────────────

export function createOwnPerson(args: Rpc['create_own_person']['Args']) {
  return callRpc('create_own_person', args)
}

export function createWalkInPerson(args: Rpc['create_walk_in_person']['Args']) {
  return callRpc('create_walk_in_person', args)
}

export function searchPersons(args: Rpc['person_search']['Args']) {
  return callRpc('person_search', args)
}

export function fetchDuplicateCandidates(args: Rpc['duplicate_candidates']['Args']) {
  return callRpc('duplicate_candidates', args)
}

export function supersedePerson(args: Rpc['supersede_person']['Args']) {
  return callRpc('supersede_person', args)
}

export function linkPersonAccount(args: Rpc['link_person_account']['Args']) {
  return callRpc('link_person_account', args)
}

export function unlinkPersonAccount(args: Rpc['unlink_person_account']['Args']) {
  return callRpc('unlink_person_account', args)
}

// ── Verification lifecycle ──────────────────────────────────────────────────

export function createVerificationApplication(
  args: Rpc['create_verification_application']['Args'],
) {
  return callRpc('create_verification_application', args)
}

export function submitVerification(args: Rpc['submit_verification']['Args']) {
  return callRpc('submit_verification', args)
}

export function reviewVerification(args: Rpc['review_verification']['Args']) {
  return callRpc('review_verification', args)
}

export function requestInformation(args: Rpc['request_information']['Args']) {
  return callRpc('request_information', args)
}

export function resubmitVerification(args: Rpc['resubmit_verification']['Args']) {
  return callRpc('resubmit_verification', args)
}

export function approveVerification(args: Rpc['approve_verification']['Args']) {
  return callRpc('approve_verification', args)
}

export function rejectVerification(args: Rpc['reject_verification']['Args']) {
  return callRpc('reject_verification', args)
}

// ── Evidence metadata ───────────────────────────────────────────────────────

export function addEvidenceMetadata(args: Rpc['add_evidence_metadata']['Args']) {
  return callRpc('add_evidence_metadata', args)
}

export function confirmEvidenceUpload(args: Rpc['confirm_evidence_upload']['Args']) {
  return callRpc('confirm_evidence_upload', args)
}

export function removeEvidence(args: Rpc['remove_evidence']['Args']) {
  return callRpc('remove_evidence', args)
}
