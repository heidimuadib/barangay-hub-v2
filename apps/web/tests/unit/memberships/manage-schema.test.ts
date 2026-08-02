import { describe, expect, it } from 'vitest'

import {
  inviteMemberSchema,
  membershipStatusSchema,
  roleAssignmentSchema,
  updateMembershipStatusSchema,
} from '@/features/memberships/schemas/manage.schema'

const BARANGAY = 'a0000000-0000-4000-8000-000000000001'
const MEMBERSHIP = 'b0000000-0000-4000-8000-000000000004'

describe('membershipStatusSchema', () => {
  it('accepts exactly the three lifecycle states', () => {
    for (const status of ['invited', 'active', 'disabled']) {
      expect(membershipStatusSchema.safeParse(status).success).toBe(true)
    }
    // No invented states — the enum mirrors the database type.
    expect(membershipStatusSchema.safeParse('superuser').success).toBe(false)
    expect(membershipStatusSchema.safeParse('').success).toBe(false)
  })
})

describe('updateMembershipStatusSchema', () => {
  it('requires uuid identifiers — a forged non-uuid value never reaches the database', () => {
    expect(
      updateMembershipStatusSchema.safeParse({
        barangayId: BARANGAY,
        membershipId: MEMBERSHIP,
        status: 'active',
      }).success,
    ).toBe(true)
    expect(
      updateMembershipStatusSchema.safeParse({
        barangayId: 'anything',
        membershipId: MEMBERSHIP,
        status: 'active',
      }).success,
    ).toBe(false)
  })
})

describe('roleAssignmentSchema', () => {
  it('constrains the role key to the catalog key format', () => {
    expect(
      roleAssignmentSchema.safeParse({
        barangayId: BARANGAY,
        membershipId: MEMBERSHIP,
        roleKey: 'barangay_staff',
      }).success,
    ).toBe(true)
    for (const forged of ['DROP TABLE', 'platform_administrator!', 'A', 'role key']) {
      expect(
        roleAssignmentSchema.safeParse({
          barangayId: BARANGAY,
          membershipId: MEMBERSHIP,
          roleKey: forged,
        }).success,
      ).toBe(false)
    }
  })
})

describe('inviteMemberSchema', () => {
  it('normalises the invite email like the sign-in schema does', () => {
    const parsed = inviteMemberSchema.safeParse({
      barangayId: BARANGAY,
      email: ' Resident.Malinis@Barangay-Hub.TEST ',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.email).toBe('resident.malinis@barangay-hub.test')
    }
  })

  it('rejects malformed emails and non-uuid barangay ids', () => {
    expect(
      inviteMemberSchema.safeParse({ barangayId: BARANGAY, email: 'not-an-email' }).success,
    ).toBe(false)
    expect(
      inviteMemberSchema.safeParse({ barangayId: 'forged', email: 'a@barangay-hub.test' }).success,
    ).toBe(false)
  })
})
