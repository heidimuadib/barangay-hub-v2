import { z } from 'zod'

/**
 * Validates the `auth_context()` RPC payload.
 *
 * Strict on shape, fail closed on content: a payload that does not parse is
 * treated as "no session", never as "assume something reasonable".
 */
export const membershipContextSchema = z.object({
  membershipId: z.string().uuid(),
  barangayId: z.string().uuid(),
  barangayCode: z.string().min(1),
  barangayName: z.string().min(1),
  status: z.enum(['invited', 'active', 'disabled']),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
})

export const authContextSchema = z.object({
  userId: z.string().uuid(),
  // A deleted profile row must not lock the account out of sign-out.
  displayName: z.string().catch('Account'),
  isPlatformAdmin: z.boolean(),
  platformPermissions: z.array(z.string()),
  memberships: z.array(membershipContextSchema),
})

/** The unauthenticated payload: `{"userId": null}`. */
export const emptyContextSchema = z.object({ userId: z.null() })
