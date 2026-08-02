import 'server-only'

import { requirePermission } from '@/features/identity'

import { REGISTRY_PERMISSIONS } from '../constants'
import * as registryRepo from '../repositories/registry-repository'
import { unwrap } from '../repositories/registry-repository'
import {
  fetchPersonDetail,
  fetchPersonsByIds,
  fetchRegistryPage,
  fetchSupersededInto,
  type RegistryListRow,
} from '../repositories/staff-registry-repository'
import { candidatePriority, similarityBand } from '../rules/duplicate-scoring'
import type {
  DuplicateCandidate,
  DuplicateComparisonRow,
  DuplicateReview,
  PersonLink,
  PersonSearchHit,
  PersonSource,
  RegistryEntry,
  ResidencyBasisKey,
} from '../types/registry'

export type { RegistryListRow }

export const REGISTRY_PAGE_SIZE = 20

function toEntry(row: RegistryListRow): RegistryEntry {
  // Newest application wins — a person may have several once a terminal one
  // is followed by a fresh attempt.
  const latest = [...row.verification_applications].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0]

  return {
    personId: row.id,
    fullName: [row.first_name, row.middle_name, row.last_name, row.suffix]
      .filter((part): part is string => Boolean(part && part.length > 0))
      .join(' '),
    birthdate: row.birthdate,
    residencyBasisKey: row.residency_basis_key as ResidencyBasisKey,
    sourceChannel: row.source_channel as PersonSource,
    superseded: row.superseded_by !== null,
    hasAccount: row.person_accounts.length > 0,
    verificationState: latest?.state ?? null,
  }
}

export interface RegistryPageResult {
  readonly entries: readonly RegistryEntry[]
  readonly total: number
  readonly page: number
  readonly pageCount: number
}

/** Paginated tenant registry. Requires `registry.read` (audited on denial). */
export async function listRegistry(barangayId: string, page: number): Promise<RegistryPageResult> {
  await requirePermission(barangayId, REGISTRY_PERMISSIONS.registryRead)

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const { rows, total } = await fetchRegistryPage({
    barangayId,
    limit: REGISTRY_PAGE_SIZE,
    offset: (safePage - 1) * REGISTRY_PAGE_SIZE,
  })

  return {
    entries: rows.map(toEntry),
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / REGISTRY_PAGE_SIZE)),
  }
}

export async function getPersonDetail(
  barangayId: string,
  personId: string,
): Promise<RegistryEntry | null> {
  await requirePermission(barangayId, REGISTRY_PERMISSIONS.registryRead)
  const row = await fetchPersonDetail(barangayId, personId)
  return row === null ? null : toEntry(row)
}

/**
 * Registry search. The term reaches this function through a POST body only —
 * it is never a query parameter, and it is never logged (Phase 6 §37.2).
 */
export async function searchRegistry(
  barangayId: string,
  term: string,
): Promise<readonly PersonSearchHit[]> {
  await requirePermission(barangayId, REGISTRY_PERMISSIONS.registryRead)

  const rows = unwrap(
    await registryRepo.searchPersons({
      p_barangay_id: barangayId,
      p_query: term,
      p_limit: 25,
    }),
    'person_search',
  )

  return rows.map((row) => ({
    personId: row.person_id,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    birthdate: row.birthdate,
    residencyBasisKey: row.residency_basis_key,
    sourceChannel: row.source_channel,
    superseded: row.superseded,
    hasAccount: row.has_account,
    rank: row.rank,
  }))
}

/**
 * Duplicate candidates for a proposed walk-in. WARNINGS ONLY — nothing is
 * merged or resolved here; resolution is subpart 2E and requires a separate
 * capability (ADR-0006 points 9–11).
 */
export async function findDuplicateCandidates(params: {
  barangayId: string
  firstName: string
  lastName: string
  birthdate?: string | undefined
}): Promise<readonly DuplicateCandidate[]> {
  await requirePermission(params.barangayId, REGISTRY_PERMISSIONS.registryRead)

  const rows = unwrap(
    await registryRepo.fetchDuplicateCandidates({
      p_barangay_id: params.barangayId,
      p_first_name: params.firstName,
      p_last_name: params.lastName,
      ...(params.birthdate === undefined ? {} : { p_birthdate: params.birthdate }),
    }),
    'duplicate_candidates',
  )

  return rows.map((row) => ({
    personId: row.person_id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthdate: row.birthdate,
    nameSimilarity: row.name_similarity,
    sameBirthdate: row.same_birthdate,
    hasAccount: row.has_account,
  }))
}

/**
 * Staff-assisted person creation. The capability gate is `create_walk_in`
 * (administrators only under the ADR-0006 mapping — `barangay_staff` does NOT
 * hold it), and the database re-checks it inside the definer function.
 */
export async function createWalkIn(params: {
  barangayId: string
  firstName: string
  lastName: string
  residencyBasis: ResidencyBasisKey
  reason: string
  middleName?: string | undefined
  suffix?: string | undefined
  birthdate?: string | undefined
  contactPhone?: string | undefined
  addressLine?: string | undefined
  residencyExplanation?: string | undefined
}): Promise<string> {
  await requirePermission(params.barangayId, REGISTRY_PERMISSIONS.createWalkIn)

  return unwrap(
    await registryRepo.createWalkInPerson({
      p_barangay_id: params.barangayId,
      p_first_name: params.firstName,
      p_last_name: params.lastName,
      p_residency_basis: params.residencyBasis,
      p_reason: params.reason,
      ...(params.middleName === undefined ? {} : { p_middle_name: params.middleName }),
      ...(params.suffix === undefined ? {} : { p_suffix: params.suffix }),
      ...(params.birthdate === undefined ? {} : { p_birthdate: params.birthdate }),
      ...(params.contactPhone === undefined ? {} : { p_contact_phone: params.contactPhone }),
      ...(params.addressLine === undefined ? {} : { p_address_line: params.addressLine }),
      ...(params.residencyExplanation === undefined
        ? {}
        : { p_residency_explanation: params.residencyExplanation }),
    }),
    'create_walk_in_person',
  )
}

// ── Duplicate review and resolution (Slice 2E) ──────────────────────────────

function toLink(row: {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
}): PersonLink {
  return {
    personId: row.id,
    fullName: [row.first_name, row.middle_name, row.last_name, row.suffix]
      .filter((part): part is string => Boolean(part && part.length > 0))
      .join(' '),
  }
}

/**
 * Everything the duplicate review panel shows for one person: the record
 * itself, its supersede links in both directions, and the side-by-side
 * candidates with the reasons they were flagged.
 *
 * Requires `registry.read` only — SEEING the comparison is ordinary staff
 * work; RESOLVING it is `registry.resolve_duplicates`, checked separately by
 * the action and again inside the database. Candidates for an
 * already-superseded record are deliberately empty: a frozen record is
 * history, not a merge target.
 */
export async function getDuplicateReview(
  barangayId: string,
  personId: string,
): Promise<DuplicateReview | null> {
  await requirePermission(barangayId, REGISTRY_PERMISSIONS.registryRead)

  const row = await fetchPersonDetail(barangayId, personId)
  if (row === null) return null
  const entry = toEntry(row)

  const supersededBy = row.superseded_by
    ? ((await fetchPersonsByIds(barangayId, [row.superseded_by])).map(toLink)[0] ?? null)
    : null

  const absorbed = (await fetchSupersededInto(barangayId, personId)).map(toLink)

  let candidates: readonly DuplicateComparisonRow[] = []
  if (!entry.superseded) {
    const signals = unwrap(
      await registryRepo.fetchDuplicateCandidates({
        p_barangay_id: barangayId,
        p_first_name: row.first_name,
        p_last_name: row.last_name,
        p_exclude_person: personId,
        ...(row.birthdate === null ? {} : { p_birthdate: row.birthdate }),
      }),
      'duplicate_candidates',
    )

    const details = await fetchPersonsByIds(
      barangayId,
      signals.map((signal) => signal.person_id),
    )
    const byId = new Map(details.map((detail) => [detail.id, toEntry(detail)]))

    // Rank on the RAW signals (the rule: birthdate outranks name strength),
    // then map to the safe presentation bands.
    candidates = [...signals]
      .sort(
        (a, b) =>
          candidatePriority(b.name_similarity, b.same_birthdate) -
          candidatePriority(a.name_similarity, a.same_birthdate),
      )
      .map((signal): DuplicateComparisonRow | null => {
        const detail = byId.get(signal.person_id)
        if (!detail) return null
        return {
          personId: detail.personId,
          fullName: detail.fullName,
          birthdate: detail.birthdate,
          residencyBasisKey: detail.residencyBasisKey,
          sourceChannel: detail.sourceChannel,
          hasAccount: detail.hasAccount,
          verificationState: detail.verificationState,
          similarityBand: similarityBand(signal.name_similarity),
          sameBirthdate: signal.same_birthdate,
        }
      })
      .filter((candidate): candidate is DuplicateComparisonRow => candidate !== null)
  }

  return { entry, supersededBy, absorbed, candidates }
}

/**
 * Supersede-and-link, exactly as ruled (ADR-0006 §D2-02): explicit survivor,
 * required reason, administrator capability. The definer function re-checks
 * the capability and every eligibility rule — self-pair, cross-tenant,
 * already-superseded sides, an open application on the loser, two linked
 * accounts — and performs the audited account move where the one explicit
 * rule allows it. Nothing is deleted, ever.
 */
export async function resolveDuplicateBySupersede(params: {
  barangayId: string
  loserPersonId: string
  survivorPersonId: string
  reason: string
}): Promise<void> {
  await requirePermission(params.barangayId, REGISTRY_PERMISSIONS.resolveDuplicates)

  unwrap(
    await registryRepo.supersedePerson({
      p_loser_id: params.loserPersonId,
      p_survivor_id: params.survivorPersonId,
      p_reason: params.reason,
    }),
    'supersede_person',
  )
}
