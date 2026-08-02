import { describe, expect, it } from 'vitest'

import { signInSchema, updateProfileSchema } from '@/features/identity/schemas/sign-in.schema'

describe('signInSchema', () => {
  it('normalises the email: trimmed and lower-cased', () => {
    const parsed = signInSchema.safeParse({
      email: '  Resident.SanIsidro@Barangay-Hub.TEST ',
      password: 'password123-local',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.email).toBe('resident.sanisidro@barangay-hub.test')
    }
  })

  it('rejects a malformed email and an empty password', () => {
    expect(signInSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false)
    expect(signInSchema.safeParse({ email: 'a@barangay-hub.test', password: '' }).success).toBe(
      false,
    )
  })

  it('rejects missing fields outright (fail closed)', () => {
    expect(signInSchema.safeParse({}).success).toBe(false)
  })
})

describe('updateProfileSchema', () => {
  it('trims the display name and enforces presence', () => {
    const parsed = updateProfileSchema.safeParse({ displayName: '  Juan D. (Test)  ' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.displayName).toBe('Juan D. (Test)')
    }
    expect(updateProfileSchema.safeParse({ displayName: '   ' }).success).toBe(false)
  })

  it('caps the display name at 120 characters — matching the database constraint', () => {
    expect(updateProfileSchema.safeParse({ displayName: 'x'.repeat(120) }).success).toBe(true)
    expect(updateProfileSchema.safeParse({ displayName: 'x'.repeat(121) }).success).toBe(false)
  })
})
