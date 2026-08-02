export type MembershipStatus = 'invited' | 'active' | 'disabled'

export interface MembershipContext {
  readonly membershipId: string
  readonly barangayId: string
  readonly barangayCode: string
  readonly barangayName: string
  readonly status: MembershipStatus
  readonly roles: readonly string[]
  /** Empty unless status is 'active' — the database guarantees this. */
  readonly permissions: readonly string[]
}

/**
 * The caller's complete authorization context, resolved live from the
 * database in one round trip (`auth_context()`), never from JWT claims.
 */
export interface AuthorizationContext {
  readonly userId: string
  readonly displayName: string
  readonly isPlatformAdmin: boolean
  readonly platformPermissions: readonly string[]
  readonly memberships: readonly MembershipContext[]
}
