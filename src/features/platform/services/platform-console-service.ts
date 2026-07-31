import 'server-only'

import { PERMISSIONS, requirePlatformPermission } from '@/features/identity'

import {
  fetchPlatformAssignments,
  fetchTenants,
  type PlatformAssignmentRow,
  type TenantRow,
} from '../repositories/platform-repository'

// Barrel-facing re-export: feature-index may not import repositories directly.
export type { PlatformAssignmentRow, TenantRow } from '../repositories/platform-repository'

/**
 * Platform console reads (Slice 1 is read-only). Tenant lifecycle mutations
 * arrive later as the 'tenant-provisioning' service-role operation.
 */
export async function listTenants(): Promise<readonly TenantRow[]> {
  await requirePlatformPermission(PERMISSIONS.platformBarangayRead)
  return fetchTenants()
}

export async function listPlatformAssignments(): Promise<readonly PlatformAssignmentRow[]> {
  await requirePlatformPermission(PERMISSIONS.platformBarangayRead)
  return fetchPlatformAssignments()
}
