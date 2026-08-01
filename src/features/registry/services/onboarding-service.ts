import 'server-only'

import { requireAuthenticatedUser } from '@/features/identity'

import {
  fetchOwnRegistryState,
  listActiveBarangays,
  type BarangayDirectoryEntry,
  type OwnRegistryRow,
} from '../repositories/onboarding-repository'

export type { BarangayDirectoryEntry, OwnRegistryRow }

/**
 * Resident-facing onboarding reads. Authentication is required; no capability
 * is — these return only the caller's own record, enforced by RLS.
 */
export async function getBarangayDirectory(): Promise<readonly BarangayDirectoryEntry[]> {
  await requireAuthenticatedUser()
  return listActiveBarangays()
}

export async function getOwnRegistryState(): Promise<OwnRegistryRow | null> {
  await requireAuthenticatedUser()
  return fetchOwnRegistryState()
}
