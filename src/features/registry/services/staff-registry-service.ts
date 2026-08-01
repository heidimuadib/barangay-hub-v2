import 'server-only'

import { requirePermission } from '@/features/identity'

import { REGISTRY_PERMISSIONS } from '../constants'
import * as registryRepo from '../repositories/registry-repository'
import { unwrap } from '../repositories/registry-repository'
import {
  fetchPersonDetail,
  fetchRegistryPage,
  type RegistryListRow,
} from '../repositories/staff-registry-repository'
import type {
  DuplicateCandidate,
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
