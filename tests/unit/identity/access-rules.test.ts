import { describe, expect, it } from 'vitest'

import {
  activeMembership,
  can,
  hasStaffCapability,
  landingRouteFor,
  resolveActiveBarangay,
} from '@/features/identity/rules/access-rules'
import type { AuthorizationContext, MembershipContext } from '@/features/identity/types/context'

const BARANGAY_A = '11111111-1111-4111-8111-111111111111'
const BARANGAY_B = '22222222-2222-4222-8222-222222222222'

function membership(overrides: Partial<MembershipContext>): MembershipContext {
  return {
    membershipId: 'm-1',
    barangayId: BARANGAY_A,
    barangayCode: 'test-a',
    barangayName: 'Barangay A (Test)',
    status: 'active',
    roles: ['resident'],
    permissions: [],
    ...overrides,
  }
}

function context(overrides: Partial<AuthorizationContext>): AuthorizationContext {
  return {
    userId: 'u-1',
    displayName: 'Test User',
    isPlatformAdmin: false,
    platformPermissions: [],
    memberships: [],
    ...overrides,
  }
}

describe('activeMembership', () => {
  it('returns the active membership for the barangay', () => {
    const target = membership({})
    expect(activeMembership(context({ memberships: [target] }), BARANGAY_A)).toBe(target)
  })

  it('fails closed on a null context', () => {
    expect(activeMembership(null, BARANGAY_A)).toBeNull()
  })

  it('never returns an invited or disabled membership', () => {
    const ctx = context({
      memberships: [membership({ status: 'invited' }), membership({ status: 'disabled' })],
    })
    expect(activeMembership(ctx, BARANGAY_A)).toBeNull()
  })

  it('never returns a membership of another barangay', () => {
    const ctx = context({ memberships: [membership({ barangayId: BARANGAY_B })] })
    expect(activeMembership(ctx, BARANGAY_A)).toBeNull()
  })
})

describe('can', () => {
  it('is true only when an ACTIVE membership carries the permission', () => {
    const ctx = context({
      memberships: [membership({ permissions: ['membership.read'] })],
    })
    expect(can(ctx, BARANGAY_A, 'membership.read')).toBe(true)
    expect(can(ctx, BARANGAY_A, 'membership.manage')).toBe(false)
    expect(can(ctx, BARANGAY_B, 'membership.read')).toBe(false)
    expect(can(null, BARANGAY_A, 'membership.read')).toBe(false)
  })

  it('resolves nothing from an invited membership even when roles are assigned', () => {
    const ctx = context({
      memberships: [membership({ status: 'invited', permissions: [] })],
    })
    expect(can(ctx, BARANGAY_A, 'membership.read')).toBe(false)
  })
})

describe('hasStaffCapability', () => {
  it('is true for any staff capability on any active membership', () => {
    const ctx = context({
      memberships: [
        membership({ barangayId: BARANGAY_B, permissions: [] }),
        membership({ permissions: ['audit.read'] }),
      ],
    })
    expect(hasStaffCapability(ctx)).toBe(true)
  })

  it('is false for residents, null contexts and platform-only accounts', () => {
    expect(hasStaffCapability(context({ memberships: [membership({})] }))).toBe(false)
    expect(hasStaffCapability(null)).toBe(false)
    expect(hasStaffCapability(context({ isPlatformAdmin: true }))).toBe(false)
  })
})

describe('resolveActiveBarangay', () => {
  const first = membership({ membershipId: 'm-1' })
  const second = membership({ membershipId: 'm-2', barangayId: BARANGAY_B, barangayCode: 'test-b' })

  it('honours a cookie that points at an active membership', () => {
    const ctx = context({ memberships: [first, second] })
    expect(resolveActiveBarangay(ctx, BARANGAY_B)).toBe(second)
  })

  it('falls back to the first active membership on a FORGED or foreign cookie value', () => {
    const ctx = context({ memberships: [first, second] })
    expect(resolveActiveBarangay(ctx, '99999999-9999-4999-8999-999999999999')).toBe(first)
    expect(resolveActiveBarangay(ctx, 'not-even-a-uuid')).toBe(first)
  })

  it('never resolves a disabled membership from the cookie', () => {
    const disabled = membership({ status: 'disabled' })
    const ctx = context({ memberships: [disabled, second] })
    expect(resolveActiveBarangay(ctx, BARANGAY_A)).toBe(second)
  })

  it('fails closed with no context or no active memberships', () => {
    expect(resolveActiveBarangay(null, BARANGAY_A)).toBeNull()
    expect(
      resolveActiveBarangay(
        context({ memberships: [membership({ status: 'invited' })] }),
        undefined,
      ),
    ).toBeNull()
  })
})

describe('landingRouteFor', () => {
  it('routes platform administrators to the console', () => {
    expect(landingRouteFor(context({ isPlatformAdmin: true }))).toBe('/platform')
  })

  it('routes staff-capable members to the workspace', () => {
    const ctx = context({ memberships: [membership({ permissions: ['membership.read'] })] })
    expect(landingRouteFor(ctx)).toBe('/staff')
  })

  it('routes everyone else to the resident dashboard', () => {
    expect(landingRouteFor(context({ memberships: [membership({})] }))).toBe('/dashboard')
  })
})
