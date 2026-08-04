import 'server-only'

import { AuthorizationError, BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@barangay-hub/supabase/types'

import type {
  CatalogEntry,
  DocumentRequestState,
  DocumentTypeDetail,
  OwnRequestDetail,
  OwnRequestSummary,
  RequestAnswerView,
  RequestQueueEntry,
  RequirementField,
  ResidentStanding,
  StaffRequestDetail,
  VerificationState,
} from '../types/documents'

/**
 * Reads and RPC wrappers for the document catalog and request intake.
 *
 * Every call runs on the caller's OWN session: the SECURITY DEFINER functions
 * re-check ownership or capability, and RLS scopes every read. This module
 * moves data and nothing else — the audited guard lives in the service.
 *
 * The resident reads below are additionally filtered by `person_id` even
 * though RLS already restricts them. That is not redundancy for its own sake:
 * the same policies admit a staff member holding `requests.read`, so without
 * the filter a staff member visiting a RESIDENT route would silently be shown
 * the whole tenant's requests. Own-means-own is enforced here too.
 */

type Rpc = Database['public']['Functions']

export type DocumentFailure =
  | 'denied'
  | 'not-verified'
  | 'type-unavailable'
  | 'not-editable'
  | 'requirement-not-applicable'
  | 'requirements-incomplete'
  | 'illegal-transition'
  | 'person-unavailable'
  | 'evidence-required'
  | 'evidence-already-confirmed'
  | 'evidence-object-missing'

const FAILURE_BY_MESSAGE: readonly (readonly [string, DocumentFailure])[] = [
  ['AUTHORIZATION_DENIED', 'denied'],
  ['AUTHENTICATION_REQUIRED', 'denied'],
  ['RESIDENT_NOT_VERIFIED', 'not-verified'],
  ['DOCUMENT_TYPE_NOT_AVAILABLE', 'type-unavailable'],
  ['REQUEST_NOT_EDITABLE', 'not-editable'],
  ['REQUIREMENT_NOT_APPLICABLE', 'requirement-not-applicable'],
  ['REQUIREMENTS_INCOMPLETE', 'requirements-incomplete'],
  ['ILLEGAL_TRANSITION', 'illegal-transition'],
  ['PERSON_NOT_AVAILABLE', 'person-unavailable'],
  ['EVIDENCE_REQUIRED', 'evidence-required'],
  ['EVIDENCE_ALREADY_CONFIRMED', 'evidence-already-confirmed'],
  ['EVIDENCE_OBJECT_MISSING', 'evidence-object-missing'],
  ['EVIDENCE_SIZE_INVALID', 'evidence-object-missing'],
]

export function mapDocumentError(message: string): DocumentFailure | null {
  for (const [needle, failure] of FAILURE_BY_MESSAGE) {
    if (message.includes(needle)) return failure
  }
  return null
}

export type RpcOutcome<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly failure: DocumentFailure }

/**
 * Translates a refusal into the application's error vocabulary.
 *
 * Lives at the repository layer because both document services need it and a
 * service may not import another service (Phase 6 §16.1) — the same reasoning
 * that put `throwRegistryFailure` here in Slice 2.
 */
export function throwDocumentFailure(failure: DocumentFailure): never {
  switch (failure) {
    case 'denied':
      throw new AuthorizationError('You do not have permission to do that.')
    case 'not-verified':
      throw new BusinessRuleError(
        'BR-REQ-1',
        'Your barangay has not confirmed your registration yet, so you cannot request documents. Check your registration for the next step.',
      )
    case 'type-unavailable':
      // Withdrawn, cross-tenant and never-existed are one answer on purpose
      // (Phase 4 §13.6): the catalog must not become an enumeration oracle.
      throw new NotFoundError('That document is not available to request.')
    case 'person-unavailable':
      throw new NotFoundError('That record could not be found.')
    case 'not-editable':
      throw new ConflictError(
        'This request has been submitted and can no longer be changed.',
        'state',
      )
    case 'illegal-transition':
      throw new ConflictError('That step is not available for this request.', 'state')
    case 'requirement-not-applicable':
      throw new BusinessRuleError('BR-REQ-2', 'That answer does not belong to this document.')
    case 'requirements-incomplete':
      throw new BusinessRuleError(
        'BR-REQ-3',
        'Answer every required question before submitting this request.',
      )
    case 'evidence-required':
      throw new BusinessRuleError(
        'BR-REQ-4',
        'Attach the supporting document this request needs before submitting it.',
      )
    case 'evidence-already-confirmed':
      throw new ConflictError('That document has already been uploaded.', 'state')
    case 'evidence-object-missing':
      // The upload did not land, or landed empty. Recoverable by retrying —
      // the reserved row is still there and still satisfies nothing.
      throw new BusinessRuleError(
        'BR-REQ-5',
        'That upload did not finish. Remove the item and try attaching it again.',
      )
  }
}

/** Unwraps an outcome or throws the mapped AppError. */
export function unwrap<T>(outcome: RpcOutcome<T>, operation: string): T {
  if (outcome.ok) return outcome.data
  logger.warn('Document request operation refused', { operation, failure: outcome.failure })
  throwDocumentFailure(outcome.failure)
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
  const failure = mapDocumentError(error.message)
  if (failure) {
    return { ok: false, failure }
  }
  throw new Error(`${name} failed: ${error.code}`)
}

// ── Request lifecycle (3A domain functions, unchanged) ──────────────────────

export function createOwnRequest(args: Rpc['create_own_request']['Args']) {
  return callRpc('create_own_request', args)
}

export function setRequestAnswer(args: Rpc['set_request_answer']['Args']) {
  return callRpc('set_request_answer', args)
}

export function submitRequest(args: Rpc['submit_request']['Args']) {
  return callRpc('submit_request', args)
}

// ── Staff channel (Slice 3C) ────────────────────────────────────────────────
// The SAME functions the resident path uses for answers and submission — the
// roadmap's "one domain service, two doors" requirement. Only creation and the
// two transitions differ, and they differ in authorization, not in behaviour.

export function createWalkInRequest(args: Rpc['create_walk_in_request']['Args']) {
  return callRpc('create_walk_in_request', args)
}

export function reviewRequest(args: Rpc['review_request']['Args']) {
  return callRpc('review_request', args)
}

export function markRequestReady(args: Rpc['mark_request_ready']['Args']) {
  return callRpc('mark_request_ready', args)
}

// ── Supporting evidence (Slice 3D) ──────────────────────────────────────────

export function addRequestEvidenceMetadata(args: Rpc['add_request_evidence_metadata']['Args']) {
  return callRpc('add_request_evidence_metadata', args)
}

export function confirmRequestEvidenceUpload(args: Rpc['confirm_request_evidence_upload']['Args']) {
  return callRpc('confirm_request_evidence_upload', args)
}

export function removeRequestEvidence(args: Rpc['remove_request_evidence']['Args']) {
  return callRpc('remove_request_evidence', args)
}

// ── Column lists ────────────────────────────────────────────────────────────
// Named once so the catalog list, the catalog detail and the request detail
// cannot drift into showing different fields for the same document type.

const TYPE_COLUMNS =
  'id, code, name, description, fee_amount, fee_currency, sla_days, validity_days, values_are_placeholder, requires_supporting_evidence'

const REQUIREMENT_COLUMNS =
  'id, key, label, help_text, input_kind, is_required, options, sort_order'

interface TypeRow {
  id: string
  code: string
  name: string
  description: string | null
  fee_amount: number | null
  fee_currency: string
  sla_days: number | null
  validity_days: number | null
  values_are_placeholder: boolean
  requires_supporting_evidence: boolean
}

interface RequirementRow {
  id: string
  key: string
  label: string
  help_text: string | null
  input_kind: Database['public']['Enums']['requirement_input_kind']
  is_required: boolean
  options: unknown
  sort_order: number
}

function toCatalogEntry(row: TypeRow, requirementCount: number): CatalogEntry {
  return {
    documentTypeId: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    terms: {
      feeAmount: row.fee_amount,
      feeCurrency: row.fee_currency,
      slaDays: row.sla_days,
      validityDays: row.validity_days,
      valuesArePlaceholder: row.values_are_placeholder,
    },
    requiresSupportingEvidence: row.requires_supporting_evidence,
    requirementCount,
  }
}

function toRequirementField(row: RequirementRow): RequirementField {
  return {
    requirementId: row.id,
    key: row.key,
    label: row.label,
    helpText: row.help_text,
    inputKind: row.input_kind,
    isRequired: row.is_required,
    // `options` is jsonb. Anything that is not an array of strings is a
    // malformed row, and rendering a broken control is worse than no choices.
    options: Array.isArray(row.options)
      ? row.options.filter((v): v is string => typeof v === 'string')
      : [],
  }
}

// ── Catalog reads ───────────────────────────────────────────────────────────

/** The tenant's ACTIVE catalog, alphabetical. RLS scopes it to members. */
export async function listActiveDocumentTypes(
  barangayId: string,
): Promise<readonly CatalogEntry[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('document_types')
    .select(`${TYPE_COLUMNS}, document_type_requirements(id)`)
    .eq('barangay_id', barangayId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`document catalog query failed: ${error.code}`)
  }

  return (data ?? []).map((row) =>
    toCatalogEntry(
      row,
      Array.isArray(row.document_type_requirements) ? row.document_type_requirements.length : 0,
    ),
  )
}

/**
 * One ACTIVE type with its requirements, for the catalog detail page.
 *
 * Null covers withdrawn, cross-tenant and non-existent alike — the service
 * turns all three into the same not-found, so the page cannot be used to
 * discover which document types another barangay runs.
 */
export async function fetchActiveDocumentType(
  barangayId: string,
  documentTypeId: string,
): Promise<DocumentTypeDetail | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('document_types')
    .select(`${TYPE_COLUMNS}, document_type_requirements(${REQUIREMENT_COLUMNS})`)
    .eq('barangay_id', barangayId)
    .eq('id', documentTypeId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`document type query failed: ${error.code}`)
  }
  if (!data) return null

  const requirements = sortRequirements(data.document_type_requirements ?? [])
  return {
    entry: toCatalogEntry(data, requirements.length),
    requirements: requirements.map(toRequirementField),
  }
}

function sortRequirements(rows: readonly RequirementRow[]): readonly RequirementRow[] {
  // Ordered here rather than in the query because these arrive as an embedded
  // resource, where PostgREST applies no ordering of its own.
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key))
}

// ── Resident standing ───────────────────────────────────────────────────────

/**
 * The caller's person record and verification standing in one barangay.
 *
 * `user_id` is filtered explicitly rather than left to RLS: `person_accounts`
 * is also readable by staff holding `registry.read`, and an unfiltered
 * `maybeSingle()` would throw for them on a resident route.
 *
 * "Verified" is `an approved application EXISTS`, matching `person_is_verified`
 * exactly. Taking the newest row instead would disagree with the database
 * whenever an approved resident later opens a fresh application — they keep
 * their standing, and the screen must say so.
 */
export async function fetchResidentStanding(
  barangayId: string,
  userId: string,
): Promise<ResidentStanding> {
  const supabase = await createServerSupabaseClient()

  const { data: link, error: linkError } = await supabase
    .from('person_accounts')
    .select('person_id')
    .eq('barangay_id', barangayId)
    .eq('user_id', userId)
    .maybeSingle()

  if (linkError) {
    throw new Error(`person link query failed: ${linkError.code}`)
  }
  if (!link) {
    return { personId: null, verificationState: null }
  }

  const { data: applications, error: applicationError } = await supabase
    .from('verification_applications')
    .select('state, created_at')
    .eq('person_id', link.person_id)
    .order('created_at', { ascending: false })

  if (applicationError) {
    throw new Error(`verification standing query failed: ${applicationError.code}`)
  }

  const states = (applications ?? []).map((row) => row.state)
  const verificationState: VerificationState | null = states.includes('approved')
    ? 'approved'
    : (states[0] ?? null)

  return { personId: link.person_id, verificationState }
}

// ── Own requests ────────────────────────────────────────────────────────────

export interface OwnRequestPage {
  readonly entries: readonly OwnRequestSummary[]
  readonly total: number
}

export async function listOwnRequests(
  barangayId: string,
  personId: string,
  offset: number,
  limit: number,
): Promise<OwnRequestPage> {
  const supabase = await createServerSupabaseClient()
  const { data, count, error } = await supabase
    .from('document_requests')
    .select('id, state, created_at, submitted_at, document_types(name)', { count: 'exact' })
    .eq('barangay_id', barangayId)
    .eq('person_id', personId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`own requests query failed: ${error.code}`)
  }

  return {
    entries: (data ?? []).map((row) => ({
      requestId: row.id,
      state: row.state,
      documentTypeName: row.document_types?.name ?? null,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
    })),
    total: count ?? 0,
  }
}

/**
 * One of the caller's OWN requests, with everything the detail page renders.
 *
 * The type and its requirements come back even when the type has since been
 * withdrawn — migration 20260807010000 widened the catalog policies to the
 * requester's own history precisely so this page cannot go blank.
 */
export async function fetchOwnRequest(
  barangayId: string,
  personId: string,
  requestId: string,
): Promise<OwnRequestDetail | null> {
  const supabase = await createServerSupabaseClient()

  const { data: request, error: requestError } = await supabase
    .from('document_requests')
    .select(
      `id, state, purpose, created_at, submitted_at, review_started_at, ready_at,
       document_types(${TYPE_COLUMNS}, document_type_requirements(${REQUIREMENT_COLUMNS})),
       document_request_answers(requirement_id, value)`,
    )
    .eq('barangay_id', barangayId)
    .eq('person_id', personId)
    .eq('id', requestId)
    .maybeSingle()

  if (requestError) {
    throw new Error(`own request query failed: ${requestError.code}`)
  }
  if (!request || !request.document_types) return null

  const requirementRows = sortRequirements(request.document_types.document_type_requirements ?? [])
  const requirements = requirementRows.map(toRequirementField)
  const byId = new Map(requirements.map((requirement) => [requirement.requirementId, requirement]))

  const answers: RequestAnswerView[] = []
  for (const row of request.document_request_answers ?? []) {
    const requirement = byId.get(row.requirement_id)
    if (!requirement) continue
    answers.push({
      requirementId: requirement.requirementId,
      key: requirement.key,
      label: requirement.label,
      value: row.value,
    })
  }
  // Answers follow the requirement order the resident filled them in, not
  // insertion order, so re-reading the page never reshuffles the list.
  const order = new Map(
    requirements.map((requirement, index) => [requirement.requirementId, index]),
  )
  answers.sort((a, b) => (order.get(a.requirementId) ?? 0) - (order.get(b.requirementId) ?? 0))

  return {
    requestId: request.id,
    state: request.state,
    purpose: request.purpose,
    createdAt: request.created_at,
    submittedAt: request.submitted_at,
    reviewStartedAt: request.review_started_at,
    readyAt: request.ready_at,
    documentType: toCatalogEntry(request.document_types, requirements.length),
    requirements,
    answers,
  }
}

// ── Staff queue and detail (Slice 3C) ───────────────────────────────────────
//
// RLS admits these rows through `requests.read`. The requester's NAME comes
// from `persons`, which is gated separately on `registry.read` — every role in
// the ADR-0006 mapping that holds one holds the other, but the join is written
// to degrade rather than break if a future mapping splits them.

const REQUESTER_COLUMNS =
  'id, first_name, middle_name, last_name, suffix, source_channel, person_accounts(user_id)'

interface RequesterRow {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  source_channel: Database['public']['Enums']['person_source']
  person_accounts: { user_id: string }[]
}

function fullName(person: RequesterRow): string {
  return [person.first_name, person.middle_name, person.last_name, person.suffix]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(' ')
}

export interface RequestQueuePage {
  readonly entries: readonly RequestQueueEntry[]
  readonly total: number
}

/**
 * One page of the tenant intake queue, oldest waiting first.
 *
 * Ordered by `submitted_at` ascending so the person who has waited longest is
 * served first — the same rule the Slice 2 verification queue uses, and the
 * reason `document_requests_queue_idx` is `(barangay_id, state, submitted_at)`.
 */
export async function fetchRequestQueuePage(params: {
  barangayId: string
  states: readonly DocumentRequestState[]
  limit: number
  offset: number
}): Promise<RequestQueuePage> {
  const supabase = await createServerSupabaseClient()
  const { data, count, error } = await supabase
    .from('document_requests')
    .select(
      `id, state, submitted_at, created_at, source_channel,
       document_types(name), persons(${REQUESTER_COLUMNS})`,
      { count: 'exact' },
    )
    .eq('barangay_id', params.barangayId)
    .in('state', [...params.states])
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .range(params.offset, params.offset + params.limit - 1)

  if (error) {
    throw new Error(`request queue query failed: ${error.code}`)
  }

  return {
    entries: (data ?? []).map((row) => ({
      requestId: row.id,
      state: row.state,
      documentTypeName: row.document_types?.name ?? null,
      requesterName: row.persons ? fullName(row.persons) : null,
      sourceChannel: row.source_channel,
      hasAccount: (row.persons?.person_accounts.length ?? 0) > 0,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
    })),
    total: count ?? 0,
  }
}

/**
 * One request as STAFF see it: everything the resident detail shows, plus the
 * requester and the provenance the resident view deliberately omits.
 */
export async function fetchStaffRequest(
  barangayId: string,
  requestId: string,
): Promise<StaffRequestDetail | null> {
  const supabase = await createServerSupabaseClient()

  const { data: request, error } = await supabase
    .from('document_requests')
    .select(
      `id, state, purpose, created_at, submitted_at, review_started_at, ready_at,
       source_channel, creation_reason,
       document_types(${TYPE_COLUMNS}, document_type_requirements(${REQUIREMENT_COLUMNS})),
       document_request_answers(requirement_id, value),
       persons(${REQUESTER_COLUMNS})`,
    )
    .eq('barangay_id', barangayId)
    .eq('id', requestId)
    .maybeSingle()

  if (error) {
    throw new Error(`staff request detail query failed: ${error.code}`)
  }
  if (!request || !request.document_types) return null

  const requirementRows = sortRequirements(request.document_types.document_type_requirements ?? [])
  const requirements = requirementRows.map(toRequirementField)
  const byId = new Map(requirements.map((requirement) => [requirement.requirementId, requirement]))

  const answers: RequestAnswerView[] = []
  for (const row of request.document_request_answers ?? []) {
    const requirement = byId.get(row.requirement_id)
    if (!requirement) continue
    answers.push({
      requirementId: requirement.requirementId,
      key: requirement.key,
      label: requirement.label,
      value: row.value,
    })
  }
  const order = new Map(
    requirements.map((requirement, index) => [requirement.requirementId, index]),
  )
  answers.sort((a, b) => (order.get(a.requirementId) ?? 0) - (order.get(b.requirementId) ?? 0))

  return {
    requestId: request.id,
    state: request.state,
    purpose: request.purpose,
    createdAt: request.created_at,
    submittedAt: request.submitted_at,
    reviewStartedAt: request.review_started_at,
    readyAt: request.ready_at,
    sourceChannel: request.source_channel,
    creationReason: request.creation_reason,
    documentType: toCatalogEntry(request.document_types, requirements.length),
    requirements,
    answers,
    requester: request.persons
      ? {
          personId: request.persons.id,
          fullName: fullName(request.persons),
          personSource: request.persons.source_channel,
          hasAccount: request.persons.person_accounts.length > 0,
        }
      : null,
  }
}
