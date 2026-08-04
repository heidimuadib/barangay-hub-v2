import { describe, expect, it } from 'vitest'

import {
  answerSchemaFor,
  createDocumentTypeSchema,
  createOwnRequestSchema,
  createWalkInRequestSchema,
  documentTypeCodeSchema,
  requirementKeySchema,
} from '@/features/documents/schemas/documents.schema'

const UUID = '00000000-0000-4000-8000-000000000001'

describe('document type code', () => {
  it('accepts the slug form the database CHECK requires', () => {
    expect(documentTypeCodeSchema.parse('barangay-clearance')).toBe('barangay-clearance')
  })

  it('rejects anything that could carry personal data into a URL', () => {
    for (const bad of ['Barangay Clearance', 'juan@example.com', 'UPPER', 'a', '-lead']) {
      expect(documentTypeCodeSchema.safeParse(bad).success, bad).toBe(false)
    }
  })
})

describe('requirement key', () => {
  it('accepts snake_case identifiers', () => {
    expect(requirementKeySchema.parse('years_of_residency')).toBe('years_of_residency')
  })

  it('rejects hyphens and spaces', () => {
    expect(requirementKeySchema.safeParse('years-of-residency').success).toBe(false)
    expect(requirementKeySchema.safeParse('years of residency').success).toBe(false)
  })
})

describe('request creation input', () => {
  it('requires a purpose', () => {
    const result = createOwnRequestSchema.safeParse({
      barangayId: UUID,
      documentTypeId: UUID,
      purpose: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('trims the purpose so a whitespace answer cannot slip past the CHECK', () => {
    const parsed = createOwnRequestSchema.parse({
      barangayId: UUID,
      documentTypeId: UUID,
      purpose: '  Employment requirement  ',
    })
    expect(parsed.purpose).toBe('Employment requirement')
  })

  it('demands a reason on the staff-assisted path', () => {
    // The trigger raises CREATION_REASON_REQUIRED; failing here explains it.
    const base = { barangayId: UUID, documentTypeId: UUID, personId: UUID, purpose: 'X' }
    expect(createWalkInRequestSchema.safeParse(base).success).toBe(false)
    expect(
      createWalkInRequestSchema.safeParse({ ...base, reason: 'Counter walk-in' }).success,
    ).toBe(true)
  })
})

describe('answer validation mirrors the database trigger', () => {
  it('requires a number for numeric requirements', () => {
    const schema = answerSchemaFor('number')
    expect(schema.safeParse('7').success).toBe(true)
    expect(schema.safeParse('-2.5').success).toBe(true)
    expect(schema.safeParse('seven').success).toBe(false)
  })

  it('requires an ISO date for date requirements', () => {
    const schema = answerSchemaFor('date')
    expect(schema.safeParse('2026-01-15').success).toBe(true)
    expect(schema.safeParse('15/01/2026').success).toBe(false)
    expect(schema.safeParse('2026-13-45').success).toBe(false)
  })

  it('accepts only true/false for boolean requirements', () => {
    const schema = answerSchemaFor('boolean')
    expect(schema.safeParse('true').success).toBe(true)
    expect(schema.safeParse('FALSE').success).toBe(true)
    expect(schema.safeParse('yes').success).toBe(false)
  })

  it('accepts only listed options for select requirements', () => {
    const schema = answerSchemaFor('select', ['Employment', 'School'])
    expect(schema.safeParse('Employment').success).toBe(true)
    expect(schema.safeParse('Astrology').success).toBe(false)
  })

  it('rejects a blank answer for every kind', () => {
    for (const kind of ['text', 'textarea', 'number', 'date', 'boolean', 'select'] as const) {
      expect(answerSchemaFor(kind, ['x']).safeParse('   ').success, kind).toBe(false)
    }
  })
})

describe('document type creation input', () => {
  it('keeps null distinct from zero for every commercial figure', () => {
    // B-08: "no amount decided" must survive the form as null, not become 0.
    const parsed = createDocumentTypeSchema.parse({
      barangayId: UUID,
      code: 'test-type',
      name: 'Test Type',
      feeAmount: null,
      slaDays: null,
      validityDays: null,
    })
    expect(parsed.feeAmount).toBeNull()
    expect(parsed.slaDays).toBeNull()
    expect(parsed.validityDays).toBeNull()
  })

  it('accepts a genuinely free document', () => {
    const parsed = createDocumentTypeSchema.parse({
      barangayId: UUID,
      code: 'test-free',
      name: 'Free Type',
      feeAmount: 0,
    })
    expect(parsed.feeAmount).toBe(0)
  })

  it('offers no way to declare the values confirmed', () => {
    // Confirmation is an owner act recorded against B-08, never a form field.
    expect(Object.keys(createDocumentTypeSchema.shape)).not.toContain('valuesArePlaceholder')
  })

  it('rejects a negative fee and an out-of-range SLA', () => {
    const base = { barangayId: UUID, code: 'test-type', name: 'Test' }
    expect(createDocumentTypeSchema.safeParse({ ...base, feeAmount: -1 }).success).toBe(false)
    expect(createDocumentTypeSchema.safeParse({ ...base, slaDays: 400 }).success).toBe(false)
  })
})
