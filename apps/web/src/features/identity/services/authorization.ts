import 'server-only'

import { cache } from 'react'

import { AuthenticationError, AuthorizationError } from '@/lib/errors'
import { logger } from '@/lib/logger'

import {
  appendCallerAuditEntry,
  fetchAuthContextPayload,
  fetchVerifiedUserId,
} from '../repositories/identity-repository'
import { authContextSchema } from '../schemas/auth-context.schema'
import { activeMembership, can } from '../rules/access-rules'
import type { AuthorizationContext, MembershipContext } from '../types/context'

/**
 * THE authorization entry point for all server code.
 *
 * One resolution per request (`react/cache`), sourced from the database via
 * `auth_context()` — never from JWT claims, cookies, or client input
 * (Phase 4 DB-ADR-03). Every failure mode resolves to `null` (fail closed).
 */
export const getAuthorizationContext = cache(async (): Promise<AuthorizationContext | null> => {
  const userId = await fetchVerifiedUserId()
  if (userId === null) return null

  const payload = await fetchAuthContextPayload()
  const parsed = authContextSchema.safeParse(payload)
  if (!parsed.success) {
    // A malformed context is a defect, but the SAFE reading of it is
    // "unauthenticated", never "assume access".
    logger.error('Authorization context failed validation — treating as unauthenticated', {
      userId,
      issues: parsed.error.issues.map((issue) => issue.path.join('.')),
    })
    return null
  }
  return parsed.data
})

/** Throws AuthenticationError when no verified session exists. */
export async function requireAuthenticatedUser(): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext()
  if (!context) {
    throw new AuthenticationError('Sign in to continue.')
  }
  return context
}

/** Throws unless the caller has an ACTIVE membership in the barangay. */
export async function requireMembership(barangayId: string): Promise<{
  context: AuthorizationContext
  membership: MembershipContext
}> {
  const context = await requireAuthenticatedUser()
  const membership = activeMembership(context, barangayId)
  if (!membership) {
    await recordAuthorizationDenial(context, barangayId, 'membership', undefined)
    throw new AuthorizationError('You do not have access to this barangay.')
  }
  return { context, membership }
}

/**
 * Throws unless the caller holds the permission in the barangay. The denial
 * is audited BEFORE the throw, on the caller's own session, in its own
 * transaction — so the record survives the refusal (Phase 6 §24).
 */
export async function requirePermission(
  barangayId: string,
  permission: string,
): Promise<AuthorizationContext> {
  const context = await requireAuthenticatedUser()
  if (!can(context, barangayId, permission)) {
    await recordAuthorizationDenial(context, barangayId, 'permission', permission)
    throw new AuthorizationError('You do not have permission to do that.', permission)
  }
  return context
}

/**
 * Throws unless the caller holds the PLATFORM-scope permission. Platform
 * authority is entirely separate from tenant membership (Phase 4 §16.4);
 * denials land in the platform-scope audit trail (barangay_id null).
 */
export async function requirePlatformPermission(permission: string): Promise<AuthorizationContext> {
  const context = await requireAuthenticatedUser()
  if (!context.platformPermissions.includes(permission)) {
    logger.warn('Platform authorization denied', { userId: context.userId, permission })
    try {
      await appendCallerAuditEntry({
        action: 'authz.denied',
        targetType: 'authorization',
        metadata: { kind: 'platform_permission', permission },
        outcome: 'denied',
      })
    } catch (error) {
      logger.error('Audit write failed while recording a platform authorization denial', {
        userId: context.userId,
        cause: error instanceof Error ? error.message : String(error),
      })
    }
    throw new AuthorizationError('You do not have permission to do that.', permission)
  }
  return context
}

/**
 * Pure rule and repository re-exports. Neither the feature barrel nor the
 * action layer may import rules/ or repositories/ directly (boundaries), so
 * the service layer, which may, is where they surface.
 */
export {
  activeMembership,
  can,
  hasStaffCapability,
  landingRouteFor,
  resolveActiveBarangay,
} from '../rules/access-rules'
export { appendCallerAuditEntry } from '../repositories/identity-repository'

async function recordAuthorizationDenial(
  context: AuthorizationContext,
  barangayId: string,
  kind: 'membership' | 'permission',
  permission: string | undefined,
  correlationId?: string,
): Promise<void> {
  logger.warn('Authorization denied', {
    userId: context.userId,
    barangayId,
    kind,
    permission,
  })
  try {
    await appendCallerAuditEntry({
      action: 'authz.denied',
      targetType: 'authorization',
      // The denial is written into the TARGET tenant's audit trail only when
      // the caller is a member of it — otherwise the barangay id would let a
      // non-member write rows into a foreign tenant's log. Non-member denials
      // carry the tenant in metadata instead.
      ...(activeMembership(context, barangayId) === null ? {} : { barangayId }),
      metadata: {
        kind,
        ...(permission === undefined ? {} : { permission }),
        barangay_id: barangayId,
      },
      outcome: 'denied',
      ...(correlationId === undefined ? {} : { correlationId }),
    })
  } catch (error) {
    // An audit-write failure must not mask the denial itself.
    logger.error('Audit write failed while recording an authorization denial', {
      userId: context.userId,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
}
