import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthenticationError, AuthorizationError } from '@/lib/errors'

vi.mock('@/features/identity/repositories/identity-repository', () => ({
  fetchVerifiedUserId: vi.fn(),
  fetchAuthContextPayload: vi.fn(),
  appendCallerAuditEntry: vi.fn(),
  updateOwnDisplayName: vi.fn(),
}))

import {
  appendCallerAuditEntry,
  fetchAuthContextPayload,
  fetchVerifiedUserId,
} from '@/features/identity/repositories/identity-repository'
import {
  getAuthorizationContext,
  requireAuthenticatedUser,
  requirePermission,
  requirePlatformPermission,
} from '@/features/identity/services/authorization'

const USER_ID = '00000000-0000-4000-8000-000000000004'
const BARANGAY_A = 'a0000000-0000-4000-8000-000000000001'

const RESIDENT_PAYLOAD = {
  userId: USER_ID,
  displayName: 'Resident (Test)',
  isPlatformAdmin: false,
  platformPermissions: [],
  memberships: [
    {
      membershipId: 'b0000000-0000-4000-8000-000000000004',
      barangayId: BARANGAY_A,
      barangayCode: 'test-san-isidro',
      barangayName: 'San Isidro (Test)',
      status: 'active',
      roles: ['resident'],
      permissions: [],
    },
  ],
}

describe('authorization service', () => {
  beforeEach(() => {
    vi.mocked(fetchVerifiedUserId).mockResolvedValue(USER_ID)
    vi.mocked(fetchAuthContextPayload).mockResolvedValue(RESIDENT_PAYLOAD)
    vi.mocked(appendCallerAuditEntry).mockResolvedValue(undefined)
  })

  it('resolves the context from the database payload', async () => {
    const context = await getAuthorizationContext()
    expect(context?.userId).toBe(USER_ID)
    expect(context?.memberships).toHaveLength(1)
  })

  it('treats a missing session as unauthenticated', async () => {
    vi.mocked(fetchVerifiedUserId).mockResolvedValue(null)
    expect(await getAuthorizationContext()).toBeNull()
    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(AuthenticationError)
  })

  it('treats a MALFORMED context payload as unauthenticated — fail closed', async () => {
    vi.mocked(fetchAuthContextPayload).mockResolvedValue({
      userId: USER_ID,
      memberships: 'everything',
    })
    expect(await getAuthorizationContext()).toBeNull()
  })

  it('denies a missing permission and audits the denial before throwing', async () => {
    await expect(requirePermission(BARANGAY_A, 'membership.manage')).rejects.toBeInstanceOf(
      AuthorizationError,
    )
    const call = vi.mocked(appendCallerAuditEntry).mock.calls.at(-1)?.[0]
    expect(call?.action).toBe('authz.denied')
    expect(call?.outcome).toBe('denied')
    expect(call?.metadata).toMatchObject({ permission: 'membership.manage' })
  })

  it('still throws the denial when the audit write itself fails', async () => {
    vi.mocked(appendCallerAuditEntry).mockRejectedValue(new Error('db down'))
    await expect(requirePermission(BARANGAY_A, 'membership.manage')).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('denies platform permissions to tenant users and audits into the platform trail', async () => {
    await expect(requirePlatformPermission('platform.barangay.read')).rejects.toBeInstanceOf(
      AuthorizationError,
    )
    const call = vi.mocked(appendCallerAuditEntry).mock.calls.at(-1)?.[0]
    expect(call?.outcome).toBe('denied')
    // No barangayId: the event belongs to the platform-scope trail.
    expect(call && 'barangayId' in call && call.barangayId !== undefined).toBe(false)
  })
})
