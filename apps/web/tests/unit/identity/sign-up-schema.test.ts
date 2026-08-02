import { describe, expect, it } from 'vitest'

import { signUpSchema } from '@/features/identity/schemas/sign-up.schema'

const valid = {
  email: 'New.Resident@barangay-hub.test',
  password: 'a-sufficiently-long-passphrase',
  confirmPassword: 'a-sufficiently-long-passphrase',
}

describe('signUpSchema', () => {
  it('normalises the email exactly as sign-in does', () => {
    const parsed = signUpSchema.safeParse({ ...valid, email: '  New.Resident@BARANGAY-hub.test ' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.email).toBe('new.resident@barangay-hub.test')
    }
  })

  it('enforces the 12-character floor', () => {
    expect(
      signUpSchema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' }).success,
    ).toBe(false)
    expect(
      signUpSchema.safeParse({
        ...valid,
        password: 'exactly12chr',
        confirmPassword: 'exactly12chr',
      }).success,
    ).toBe(true)
  })

  it('rejects mismatched confirmation and points at the right field', () => {
    const parsed = signUpSchema.safeParse({ ...valid, confirmPassword: 'something-else-entirely' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })

  it('rejects malformed addresses', () => {
    expect(signUpSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })
})
