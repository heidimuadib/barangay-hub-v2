import { STAFF_CAPABILITIES } from '../constants'
import type { AuthorizationContext, MembershipContext } from '../types/context'

/**
 * Pure authorization predicates. Every helper here fails CLOSED: absent
 * context, unknown barangay, or a non-active membership all resolve to false.
 *
 * These mirror — never replace — the database functions. The database is the
 * authority; these exist so UI can hide controls it must not offer and so
 * actions can refuse early with an audited denial.
 */

export function activeMembership(
  context: AuthorizationContext | null,
  barangayId: string,
): MembershipContext | null {
  if (!context) return null
  const membership = context.memberships.find(
    (candidate) => candidate.barangayId === barangayId && candidate.status === 'active',
  )
  return membership ?? null
}

export function can(
  context: AuthorizationContext | null,
  barangayId: string,
  permission: string,
): boolean {
  return activeMembership(context, barangayId)?.permissions.includes(permission) ?? false
}

export function hasStaffCapability(context: AuthorizationContext | null): boolean {
  if (!context) return false
  return context.memberships.some(
    (membership) =>
      membership.status === 'active' &&
      STAFF_CAPABILITIES.some((capability) => membership.permissions.includes(capability)),
  )
}

/**
 * Resolves the active barangay from the cookie VALUE (untrusted) against the
 * live context (trusted). A forged, stale or cross-tenant cookie falls back
 * to the first active membership — it can never select a tenant the caller
 * does not actively belong to.
 */
export function resolveActiveBarangay(
  context: AuthorizationContext | null,
  cookieValue: string | undefined,
): MembershipContext | null {
  if (!context) return null
  if (cookieValue !== undefined) {
    const selected = activeMembership(context, cookieValue)
    if (selected) return selected
  }
  return context.memberships.find((membership) => membership.status === 'active') ?? null
}

/**
 * Post-sign-in destination. Platform console for platform administrators,
 * the staff workspace for anyone holding a staff capability, the resident
 * dashboard for everyone else.
 */
export function landingRouteFor(context: AuthorizationContext): string {
  if (context.isPlatformAdmin) return '/platform'
  if (hasStaffCapability(context)) return '/staff'
  return '/dashboard'
}
