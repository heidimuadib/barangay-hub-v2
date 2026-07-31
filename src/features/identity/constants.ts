/**
 * Active-barangay selection cookie.
 *
 * The cookie stores a barangay id as a CONVENIENCE pointer only. Every request
 * re-validates it against the caller's live memberships
 * (`resolveActiveBarangay`) — a forged or stale value silently falls back to
 * the first active membership, never into another tenant.
 */
export const ACTIVE_BARANGAY_COOKIE = 'bh-active-barangay'

/** Capabilities that make the staff workspace relevant to a member. */
export const STAFF_CAPABILITIES = [
  'membership.read',
  'membership.manage',
  'role.assign',
  'audit.read',
] as const

export const PERMISSIONS = {
  membershipRead: 'membership.read',
  membershipManage: 'membership.manage',
  roleAssign: 'role.assign',
  auditRead: 'audit.read',
  platformBarangayRead: 'platform.barangay.read',
  platformAuditRead: 'platform.audit.read',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
