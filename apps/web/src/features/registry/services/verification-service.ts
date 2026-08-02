import 'server-only'

import { can, requireAuthenticatedUser, requirePermission } from '@/features/identity'
import { logger } from '@/lib/logger'

import { REGISTRY_PERMISSIONS } from '../constants'
import * as registryRepo from '../repositories/registry-repository'
import { unwrap } from '../repositories/registry-repository'
import {
  fetchApplicationDetail,
  fetchEvidenceSummaries,
  fetchQueuePage,
  type QueueApplicationRow,
} from '../repositories/verification-repository'
import { isActionableByStaff } from '../rules/verification-transitions'
import type {
  ApplicationDetail,
  DuplicateCandidate,
  EvidenceKind,
  EvidenceSummary,
  PersonSource,
  ResidencyBasisKey,
  VerificationQueueEntry,
  VerificationState,
} from '../types/registry'

export const QUEUE_PAGE_SIZE = 20

/**
 * The default queue view: everything a reviewer can act on, oldest first.
 * Derived from the transition rule rather than restated.
 */
const ACTIONABLE_STATES: readonly VerificationState[] = (
  [
    'draft',
    'submitted',
    'in_review',
    'info_requested',
    'resubmitted',
    'approved',
    'rejected',
  ] as const
).filter(isActionableByStaff)

function fullName(parts: {
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
}): string {
  return [parts.first_name, parts.middle_name, parts.last_name, parts.suffix]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(' ')
}

function toQueueEntry(row: QueueApplicationRow): VerificationQueueEntry {
  return {
    applicationId: row.id,
    personId: row.persons.id,
    fullName: fullName(row.persons),
    state: row.state as VerificationState,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    sourceChannel: row.persons.source_channel as PersonSource,
    hasAccount: row.persons.person_accounts.length > 0,
  }
}

export interface VerificationQueuePage {
  readonly entries: readonly VerificationQueueEntry[]
  readonly total: number
  readonly page: number
  readonly pageCount: number
  /** The state filter actually applied; null = the default actionable set. */
  readonly stateFilter: VerificationState | null
}

/** Paginated tenant queue. Requires `verification.read` (audited on denial). */
export async function listVerificationQueue(
  barangayId: string,
  params: { state?: VerificationState | undefined; page?: number | undefined },
): Promise<VerificationQueuePage> {
  await requirePermission(barangayId, REGISTRY_PERMISSIONS.verificationRead)

  const page = params.page ?? 1
  const states = params.state ? [params.state] : ACTIONABLE_STATES
  const { rows, total } = await fetchQueuePage({
    barangayId,
    states,
    limit: QUEUE_PAGE_SIZE,
    offset: (page - 1) * QUEUE_PAGE_SIZE,
  })

  return {
    entries: rows.map(toQueueEntry),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE)),
    stateFilter: params.state ?? null,
  }
}

/**
 * Everything the review detail shows. Requires `verification.read`; a
 * wrong-tenant id and a nonexistent id both return null (RLS returns nothing
 * either way — Phase 4 §13.6).
 *
 * Evidence metadata is included only when the caller holds
 * `verification.evidence.read` (D2-04): RLS would silently return an empty
 * list to anyone else, and "no documents" must never be conflated with
 * "not yours to see" — so the capability is checked explicitly and the
 * page renders the difference honestly. File CONTENTS are 2F either way.
 */
export async function getApplicationDetail(
  barangayId: string,
  applicationId: string,
): Promise<ApplicationDetail | null> {
  const context = await requirePermission(barangayId, REGISTRY_PERMISSIONS.verificationRead)

  const row = await fetchApplicationDetail(barangayId, applicationId)
  if (row === null) return null

  const canReadEvidence = can(context, barangayId, REGISTRY_PERMISSIONS.evidenceRead)
  const evidence: readonly EvidenceSummary[] | null = canReadEvidence
    ? (await fetchEvidenceSummaries(applicationId)).map((item) => ({
        evidenceId: item.id,
        kind: item.kind as EvidenceKind,
        mimeType: item.mime_type,
        declaredSizeBytes: item.declared_size_bytes,
        sizeBytes: item.size_bytes,
        uploadedAt: item.uploaded_at,
        createdAt: item.created_at,
      }))
    : null

  // Duplicate candidates are CONTEXT for the reviewer (resolution is 2E). The
  // lookup needs registry.read, which every verification.read role also holds
  // under the ADR-0006 mapping — but if a future mapping splits them, the
  // summary degrades to empty rather than breaking the review page.
  let duplicates: readonly DuplicateCandidate[] = []
  try {
    duplicates = unwrap(
      await registryRepo.fetchDuplicateCandidates({
        p_barangay_id: barangayId,
        p_first_name: row.persons.first_name,
        p_last_name: row.persons.last_name,
        p_exclude_person: row.persons.id,
        ...(row.persons.birthdate === null ? {} : { p_birthdate: row.persons.birthdate }),
      }),
      'duplicate_candidates',
    ).map((candidate) => ({
      personId: candidate.person_id,
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      birthdate: candidate.birthdate,
      nameSimilarity: candidate.name_similarity,
      sameBirthdate: candidate.same_birthdate,
      hasAccount: candidate.has_account,
    }))
  } catch {
    logger.warn('Duplicate-candidate summary unavailable for review detail', {
      applicationId,
    })
  }

  return {
    applicationId: row.id,
    state: row.state as VerificationState,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    infoRequestNote: row.info_request_note,
    decisionReason: row.decision_reason,
    person: {
      personId: row.persons.id,
      fullName: fullName(row.persons),
      birthdate: row.persons.birthdate,
      contactPhone: row.persons.contact_phone,
      addressLine: row.persons.address_line,
      residencyBasisKey: row.persons.residency_basis_key as ResidencyBasisKey,
      residencyExplanation: row.persons.residency_basis_explanation,
      sourceChannel: row.persons.source_channel as PersonSource,
      superseded: row.persons.superseded_by !== null,
      hasAccount: row.persons.person_accounts.length > 0,
    },
    evidence,
    duplicates,
  }
}

// ── Transitions ─────────────────────────────────────────────────────────────
// Each guard names the SPECIFIC capability (D2-04 splits review from decide).
// The barangayId is the caller's claim and scopes the audited app-layer
// check; the definer function re-resolves the application's true tenant and
// re-checks the same capability there, so a forged id changes nothing.

/** submitted | resubmitted → in_review. Requires `verification.review`. */
export async function startReview(barangayId: string, applicationId: string): Promise<void> {
  await requirePermission(barangayId, REGISTRY_PERMISSIONS.verificationReview)
  unwrap(
    await registryRepo.reviewVerification({ p_application_id: applicationId }),
    'review_verification',
  )
}

/**
 * in_review → info_requested. Requires `verification.request_information`;
 * the note is required and travels to the resident, and the intent is
 * enqueued in the same database transaction (Slice 2D migration).
 */
export async function requestMoreInformation(params: {
  barangayId: string
  applicationId: string
  note: string
  correlationId?: string | undefined
}): Promise<void> {
  await requirePermission(params.barangayId, REGISTRY_PERMISSIONS.requestInformation)
  unwrap(
    await registryRepo.requestInformation({
      p_application_id: params.applicationId,
      p_note: params.note,
      ...(params.correlationId === undefined ? {} : { p_correlation_id: params.correlationId }),
    }),
    'request_information',
  )
}

/**
 * in_review → approved. Requires `verification.approve`. Membership
 * activation and the outbox intent happen inside the database transaction;
 * a deliberately disabled membership refuses the whole approval.
 */
export async function approveApplication(params: {
  barangayId: string
  applicationId: string
  correlationId?: string | undefined
}): Promise<void> {
  await requirePermission(params.barangayId, REGISTRY_PERMISSIONS.approve)
  unwrap(
    await registryRepo.approveVerification({
      p_application_id: params.applicationId,
      ...(params.correlationId === undefined ? {} : { p_correlation_id: params.correlationId }),
    }),
    'approve_verification',
  )
}

/** in_review → rejected. Requires `verification.reject` and a reason. */
export async function rejectApplication(params: {
  barangayId: string
  applicationId: string
  reason: string
  correlationId?: string | undefined
}): Promise<void> {
  await requirePermission(params.barangayId, REGISTRY_PERMISSIONS.reject)
  unwrap(
    await registryRepo.rejectVerification({
      p_application_id: params.applicationId,
      p_reason: params.reason,
      ...(params.correlationId === undefined ? {} : { p_correlation_id: params.correlationId }),
    }),
    'reject_verification',
  )
}

/**
 * info_requested → resubmitted, by the RESIDENT for their own application —
 * ownership is enforced inside the definer function, so no capability and no
 * tenant id are needed here. Staff assisting at the counter go through the
 * same function under `verification.review` (ADR-0006 point 6).
 */
export async function resubmitOwnApplication(
  applicationId: string,
  correlationId?: string,
): Promise<void> {
  await requireAuthenticatedUser()
  unwrap(
    await registryRepo.resubmitVerification({
      p_application_id: applicationId,
      ...(correlationId === undefined ? {} : { p_correlation_id: correlationId }),
    }),
    'resubmit_verification',
  )
}
