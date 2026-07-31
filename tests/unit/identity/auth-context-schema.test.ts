import { describe, expect, it } from 'vitest'

import { authContextSchema } from '@/features/identity/schemas/auth-context.schema'

const VALID = {
  userId: '00000000-0000-4000-8000-000000000002',
  displayName: 'San Isidro Admin (Test)',
  isPlatformAdmin: false,
  platformPermissions: [],
  memberships: [
    {
      membershipId: 'b0000000-0000-4000-8000-000000000002',
      barangayId: 'a0000000-0000-4000-8000-000000000001',
      barangayCode: 'test-san-isidro',
      barangayName: 'San Isidro (Test)',
      status: 'active',
      roles: ['barangay_administrator'],
      permissions: ['audit.read', 'membership.manage', 'membership.read', 'role.assign'],
    },
  ],
}

describe('authContextSchema', () => {
  it('accepts the auth_context() payload shape', () => {
    const parsed = authContextSchema.safeParse(VALID)
    expect(parsed.success).toBe(true)
  })

  it('rejects the unauthenticated payload (fail closed)', () => {
    expect(authContextSchema.safeParse({ userId: null }).success).toBe(false)
  })

  it('rejects a payload with an unknown membership status', () => {
    const tampered = {
      ...VALID,
      memberships: [{ ...VALID.memberships[0], status: 'superuser' }],
    }
    expect(authContextSchema.safeParse(tampered).success).toBe(false)
  })

  it('rejects a payload with a non-uuid user id', () => {
    expect(authContextSchema.safeParse({ ...VALID, userId: 'admin' }).success).toBe(false)
  })

  it('tolerates a missing display name without failing the whole context', () => {
    const parsed = authContextSchema.safeParse({ ...VALID, displayName: null })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.displayName).toBe('Account')
    }
  })
})
