import 'server-only'

import { PERMISSIONS, requirePermission } from '@/features/identity'

import {
  deleteMembershipRole,
  fetchBarangayRoles,
  fetchRoster,
  insertMembershipRole,
  inviteByEmail,
  updateMembershipStatus,
  type InviteOutcome,
  type RoleMutationOutcome,
} from '../repositories/roster-repository'
import type { BarangayRoleOption, RosterMember, RosterMembershipStatus } from '../types/roster'

/**
 * Roster reads and mutations. requirePermission is the audited, fail-closed
 * gate; the RLS policies underneath enforce the same rule a second time, and
 * the database triggers audit every change in the same transaction.
 */
export async function listRoster(barangayId: string): Promise<readonly RosterMember[]> {
  await requirePermission(barangayId, PERMISSIONS.membershipRead)

  const rows = await fetchRoster(barangayId)
  return rows
    .map((row) => ({
      membershipId: row.id,
      userId: row.user_id,
      displayName: row.user_profiles?.display_name ?? 'Unknown member',
      status: row.status,
      roles: row.membership_roles.map((role) => role.role_key).sort(),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function listBarangayRoleOptions(): Promise<readonly BarangayRoleOption[]> {
  return fetchBarangayRoles()
}

export async function changeMembershipStatus(params: {
  barangayId: string
  membershipId: string
  status: RosterMembershipStatus
}): Promise<boolean> {
  await requirePermission(params.barangayId, PERMISSIONS.membershipManage)
  return updateMembershipStatus(params)
}

export async function assignRole(params: {
  barangayId: string
  membershipId: string
  roleKey: string
}): Promise<RoleMutationOutcome> {
  await requirePermission(params.barangayId, PERMISSIONS.roleAssign)
  return insertMembershipRole(params)
}

export async function removeRole(params: {
  barangayId: string
  membershipId: string
  roleKey: string
}): Promise<boolean> {
  await requirePermission(params.barangayId, PERMISSIONS.roleAssign)
  return deleteMembershipRole(params)
}

export async function inviteMember(params: {
  barangayId: string
  email: string
  correlationId?: string
}): Promise<InviteOutcome> {
  await requirePermission(params.barangayId, PERMISSIONS.membershipManage)
  return inviteByEmail(params)
}

export type { InviteOutcome, RoleMutationOutcome }
