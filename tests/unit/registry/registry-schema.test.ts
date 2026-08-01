import { describe, expect, it } from 'vitest'

import { isResidencyValid, requiresExplanation } from '@/features/registry/rules/residency'
import {
  evidenceMetadataSchema,
  personDetailsSchema,
  registrySearchSchema,
  rejectSchema,
  supersedeSchema,
  walkInCreateSchema,
} from '@/features/registry/schemas/registry.schema'

const BARANGAY = 'a0000000-0000-4000-8000-000000000001'
const APPLICATION = 'd0000000-0000-4000-8000-000000000001'

const validDetails = {
  barangayId: BARANGAY,
  firstName: 'Juan',
  lastName: 'Dela Cruz (Test)',
  residencyBasis: 'renter' as const,
}

describe('residency rules (D2-01)', () => {
  it('requires an explanation for other and only for other', () => {
    expect(requiresExplanation('other')).toBe(true)
    for (const key of [
      'property_owner',
      'renter',
      'household_member',
      'caretaker',
      'informal_resident',
    ] as const) {
      expect(requiresExplanation(key)).toBe(false)
      expect(isResidencyValid(key, null)).toBe(true)
      // Stray narrative on a non-other basis is refused.
      expect(isResidencyValid(key, 'unnecessary text')).toBe(false)
    }
    expect(isResidencyValid('other', null)).toBe(false)
    expect(isResidencyValid('other', '  ')).toBe(false)
    expect(isResidencyValid('other', 'Caretaker of a relative’s property')).toBe(true)
  })
})

describe('personDetailsSchema', () => {
  it('accepts a minimal valid person for either channel', () => {
    expect(personDetailsSchema.safeParse(validDetails).success).toBe(true)
  })

  it('enforces the D2-01 explanation rule both ways', () => {
    expect(
      personDetailsSchema.safeParse({ ...validDetails, residencyBasis: 'other' }).success,
    ).toBe(false)
    expect(
      personDetailsSchema.safeParse({
        ...validDetails,
        residencyBasis: 'other',
        residencyExplanation: 'Synthetic arrangement',
      }).success,
    ).toBe(true)
    expect(
      personDetailsSchema.safeParse({
        ...validDetails,
        residencyExplanation: 'must not appear here',
      }).success,
    ).toBe(false)
  })

  it('rejects forged tenant ids and unknown bases at the shape layer', () => {
    expect(
      personDetailsSchema.safeParse({ ...validDetails, barangayId: 'not-a-uuid' }).success,
    ).toBe(false)
    expect(
      personDetailsSchema.safeParse({ ...validDetails, residencyBasis: 'squatter' }).success,
    ).toBe(false)
  })
})

describe('personDetailsSchema normalisation (Slice 2C)', () => {
  it('normalises names without altering their substance', () => {
    const parsed = personDetailsSchema.safeParse({
      ...validDetails,
      firstName: '  Juan   Miguel ',
      lastName: 'dela Cruz',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.firstName).toBe('Juan Miguel')
      // The particle keeps its lower case — no title-casing.
      expect(parsed.data.lastName).toBe('dela Cruz')
    }
  })

  it('rejects a name that is only whitespace once normalised', () => {
    expect(personDetailsSchema.safeParse({ ...validDetails, firstName: '   ' }).success).toBe(false)
  })

  it('strips punctuation from a phone without guessing a country code', () => {
    const parsed = personDetailsSchema.safeParse({
      ...validDetails,
      contactPhone: '0917 555-1234',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.contactPhone).toBe('09175551234')
    }
  })

  it('refuses impossible and future birthdates', () => {
    expect(
      personDetailsSchema.safeParse({ ...validDetails, birthdate: '2026-02-31' }).success,
    ).toBe(false)
    expect(
      personDetailsSchema.safeParse({ ...validDetails, birthdate: '2999-01-01' }).success,
    ).toBe(false)
    expect(
      personDetailsSchema.safeParse({ ...validDetails, birthdate: '1990-05-04' }).success,
    ).toBe(true)
  })
})

describe('registrySearchSchema (P6-C-E)', () => {
  it('requires a tenant id and a term of at least two characters', () => {
    expect(registrySearchSchema.safeParse({ barangayId: BARANGAY, term: 'a' }).success).toBe(false)
    expect(registrySearchSchema.safeParse({ barangayId: BARANGAY, term: '  ' }).success).toBe(false)
    expect(registrySearchSchema.safeParse({ barangayId: 'not-a-uuid', term: 'cruz' }).success).toBe(
      false,
    )
    expect(registrySearchSchema.safeParse({ barangayId: BARANGAY, term: 'cruz' }).success).toBe(
      true,
    )
  })

  it('caps the term length', () => {
    expect(
      registrySearchSchema.safeParse({ barangayId: BARANGAY, term: 'x'.repeat(101) }).success,
    ).toBe(false)
  })
})

describe('walkInCreateSchema', () => {
  it('requires the staff reason (ADR-0006 point 7)', () => {
    expect(walkInCreateSchema.safeParse({ details: validDetails, reason: '' }).success).toBe(false)
    expect(
      walkInCreateSchema.safeParse({
        details: validDetails,
        reason: 'Walk-in at the counter (synthetic)',
      }).success,
    ).toBe(true)
  })
})

describe('evidenceMetadataSchema (D2-03)', () => {
  it('enforces the MIME allow-list and the 10 MiB ceiling', () => {
    const base = { applicationId: APPLICATION, kind: 'identity' as const }
    expect(
      evidenceMetadataSchema.safeParse({
        ...base,
        mimeType: 'image/png',
        declaredSizeBytes: 2048,
      }).success,
    ).toBe(true)
    expect(
      evidenceMetadataSchema.safeParse({
        ...base,
        mimeType: 'application/x-msdownload',
        declaredSizeBytes: 2048,
      }).success,
    ).toBe(false)
    expect(
      evidenceMetadataSchema.safeParse({
        ...base,
        mimeType: 'image/png',
        declaredSizeBytes: 10 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false)
  })
})

describe('reason-carrying commands', () => {
  it('supersede requires loser, survivor and a reason (D2-02)', () => {
    expect(
      supersedeSchema.safeParse({
        loserPersonId: APPLICATION,
        survivorPersonId: BARANGAY,
        reason: 'Same person registered twice (synthetic)',
      }).success,
    ).toBe(true)
    expect(
      supersedeSchema.safeParse({
        loserPersonId: APPLICATION,
        survivorPersonId: BARANGAY,
        reason: '   ',
      }).success,
    ).toBe(false)
  })

  it('rejection requires a reason at the shape layer too', () => {
    expect(rejectSchema.safeParse({ applicationId: APPLICATION, reason: '' }).success).toBe(false)
    expect(
      rejectSchema.safeParse({
        applicationId: APPLICATION,
        reason: 'Evidence insufficient (synthetic)',
      }).success,
    ).toBe(true)
  })
})
