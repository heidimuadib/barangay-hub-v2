import 'server-only'

import { can, requirePermission, type AuthorizationContext } from '@/features/identity'

import { DOCUMENT_PERMISSIONS } from '../constants'
import {
  createWalkInRequest,
  fetchRequestQueuePage,
  fetchStaffRequest,
  markRequestReady,
  reviewRequest,
  setRequestAnswer,
  submitRequest,
  unwrap,
} from '../repositories/documents-repository'
import { isActionableByStaff } from '../rules/request-transitions'
import type {
  DocumentRequestState,
  RequestQueueEntry,
  RequestReviewerCapabilities,
  StaffRequestDetail,
} from '../types/documents'

/**
 * The staff intake queue and the counter workflow (Slice 3C).
 *
 * Each guard names the SPECIFIC capability the transition needs, mirroring the
 * Slice 2D split between reviewing and deciding. The barangay id is the
 * caller's claim and scopes the audited application-layer check; the definer
 * function re-resolves the request's true tenant and re-checks the same
 * capability there, so a forged id changes nothing.
 */

export const REQUEST_QUEUE_PAGE_SIZE = 20

/**
 * The default queue view: everything staff can act on, derived FROM the
 * transition rule rather than restated, so the queue cannot list a state the
 * database would refuse to move.
 */
const ACTIONABLE_STATES: readonly DocumentRequestState[] = (
  ['draft', 'submitted', 'in_review', 'ready_for_issue'] as const
).filter(isActionableByStaff)

export interface RequestQueuePage {
  readonly entries: readonly RequestQueueEntry[]
  readonly total: number
  readonly page: number
  readonly pageCount: number
  /** The state filter actually applied; null = the default actionable set. */
  readonly stateFilter: DocumentRequestState | null
}

/** Paginated tenant intake queue. Requires `requests.read` (audited denial). */
export async function listRequestQueue(
  barangayId: string,
  params: { state?: DocumentRequestState | undefined; page?: number | undefined },
): Promise<RequestQueuePage> {
  await requirePermission(barangayId, DOCUMENT_PERMISSIONS.requestsRead)

  const requested = params.page ?? 1
  const page = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1
  const states = params.state ? [params.state] : ACTIONABLE_STATES

  const { entries, total } = await fetchRequestQueuePage({
    barangayId,
    states,
    limit: REQUEST_QUEUE_PAGE_SIZE,
    offset: (page - 1) * REQUEST_QUEUE_PAGE_SIZE,
  })

  return {
    entries,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / REQUEST_QUEUE_PAGE_SIZE)),
    stateFilter: params.state ?? null,
  }
}

/**
 * One request, as staff see it. Requires `requests.read`; a wrong-tenant id
 * and a nonexistent id both return null, because RLS returns nothing either
 * way (Phase 4 §13.6).
 */
export async function getStaffRequestDetail(
  barangayId: string,
  requestId: string,
): Promise<StaffRequestDetail | null> {
  await requirePermission(barangayId, DOCUMENT_PERMISSIONS.requestsRead)
  return fetchStaffRequest(barangayId, requestId)
}

/**
 * Which controls this caller may be offered, resolved from the capabilities
 * they actually hold. Passed to `availableRequestActions`, which intersects it
 * with what the current state permits — so the UI can never advertise a
 * transition either the role or the database would refuse.
 */
export function reviewerCapabilities(
  context: AuthorizationContext | null,
  barangayId: string,
): RequestReviewerCapabilities {
  return {
    canReview: can(context, barangayId, DOCUMENT_PERMISSIONS.review),
    canMarkReady: can(context, barangayId, DOCUMENT_PERMISSIONS.markReady),
  }
}

// ── Transitions ─────────────────────────────────────────────────────────────

/** submitted → in_review. Requires `requests.review`. Enqueues the intent. */
export async function startRequestReview(params: {
  barangayId: string
  requestId: string
  correlationId?: string | undefined
}): Promise<void> {
  await requirePermission(params.barangayId, DOCUMENT_PERMISSIONS.review)
  unwrap(
    await reviewRequest({
      p_request_id: params.requestId,
      ...(params.correlationId === undefined ? {} : { p_correlation_id: params.correlationId }),
    }),
    'review_request',
  )
}

/**
 * in_review → ready_for_issue. Requires `requests.mark_ready` — a separate
 * capability because this one tells a resident their document is ready to
 * collect, and that is a promise a barangay should be able to restrict.
 */
export async function markRequestReadyForIssue(params: {
  barangayId: string
  requestId: string
  correlationId?: string | undefined
}): Promise<void> {
  await requirePermission(params.barangayId, DOCUMENT_PERMISSIONS.markReady)
  unwrap(
    await markRequestReady({
      p_request_id: params.requestId,
      ...(params.correlationId === undefined ? {} : { p_correlation_id: params.correlationId }),
    }),
    'mark_request_ready',
  )
}

// ── The assisted channel ────────────────────────────────────────────────────

/**
 * Files a request at the counter for a person who may have no account at all.
 *
 * The record this produces differs from the resident path in exactly three
 * columns — `source_channel`, `created_by`, `creation_reason` — and pgTAP
 * asserts that field-by-field. Everything after creation is the SAME code the
 * resident uses: `set_request_answer` and `submit_request`, which admit staff
 * holding `requests.create_walk_in` alongside the request's owner.
 */
export async function fileWalkInRequest(params: {
  barangayId: string
  personId: string
  documentTypeId: string
  purpose: string
  reason: string
  answers: ReadonlyMap<string, string>
}): Promise<string> {
  await requirePermission(params.barangayId, DOCUMENT_PERMISSIONS.createWalkIn)

  const requestId = unwrap(
    await createWalkInRequest({
      p_barangay_id: params.barangayId,
      p_person_id: params.personId,
      p_document_type_id: params.documentTypeId,
      p_purpose: params.purpose,
      p_reason: params.reason,
    }),
    'create_walk_in_request',
  )

  for (const [requirementId, value] of params.answers) {
    unwrap(
      await setRequestAnswer({
        p_request_id: requestId,
        p_requirement_id: requirementId,
        p_value: value,
      }),
      'set_request_answer',
    )
  }

  return requestId
}

/**
 * draft → submitted for a counter-filed request.
 *
 * Deliberately the resident's own function: a walk-in that stopped at `draft`
 * would sit in nobody's queue, and giving the assisted path its own submit
 * would be the second code path the roadmap forbids.
 */
export async function submitWalkInRequest(params: {
  barangayId: string
  requestId: string
}): Promise<void> {
  await requirePermission(params.barangayId, DOCUMENT_PERMISSIONS.createWalkIn)
  unwrap(await submitRequest({ p_request_id: params.requestId }), 'submit_request')
}
