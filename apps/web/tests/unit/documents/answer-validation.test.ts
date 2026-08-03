import { describe, expect, it } from 'vitest'

import { ANSWER_FIELD_PREFIX } from '@/features/documents/constants'
import {
  answerFieldName,
  requestActionSchema,
  validateAnswers,
} from '@/features/documents/schemas/documents.schema'
import type { RequirementField } from '@/features/documents/types/documents'

/**
 * Slice 3B — validating a whole answer set before it reaches the database.
 *
 * Every rule here is applied again by
 * `document_request_answers_before_write` and by `submit_request`. What this
 * layer adds is that a resident on a phone gets EVERY problem at once, against
 * the right field, instead of one round trip per mistake.
 */

function requirement(overrides: Partial<RequirementField> = {}): RequirementField {
  return {
    requirementId: 'f1000000-0000-4000-8000-000000000001',
    key: 'years_of_residency',
    label: 'Years of residency',
    helpText: null,
    inputKind: 'text',
    isRequired: true,
    options: [],
    ...overrides,
  }
}

describe('answerFieldName', () => {
  it('namespaces answers so a requirement cannot collide with the form itself', () => {
    // A barangay may legitimately name a requirement `purpose`; without the
    // prefix it would overwrite the request's own purpose in the same FormData.
    expect(answerFieldName('purpose')).toBe(`${ANSWER_FIELD_PREFIX}purpose`)
    expect(answerFieldName('purpose')).not.toBe('purpose')
  })

  it('uses a character the requirement-key CHECK forbids, so collision is impossible', () => {
    // The key regex is ^[a-z][a-z0-9_]{1,48}[a-z0-9]$ — no dot can appear.
    expect(ANSWER_FIELD_PREFIX).toContain('.')
  })
})

describe('validateAnswers — required and optional', () => {
  it('collects an answer for every requirement that has one', () => {
    const result = validateAnswers([requirement()], { years_of_residency: '12' })

    expect(result.fieldErrors).toEqual({})
    expect(result.answers.get('f1000000-0000-4000-8000-000000000001')).toBe('12')
  })

  it('trims before storing, so whitespace is not an answer', () => {
    const result = validateAnswers([requirement()], { years_of_residency: '  12  ' })
    expect(result.answers.get('f1000000-0000-4000-8000-000000000001')).toBe('12')
  })

  it('reports a blank required answer against its own field', () => {
    const result = validateAnswers([requirement()], { years_of_residency: '   ' })

    expect(result.fieldErrors[answerFieldName('years_of_residency')]).toEqual([
      'This answer is required.',
    ])
    expect(result.answers.size).toBe(0)
  })

  it('reports a missing required answer even when the field was never posted', () => {
    const result = validateAnswers([requirement()], {})
    expect(result.fieldErrors[answerFieldName('years_of_residency')]).toBeDefined()
  })

  it('omits a blank optional answer instead of writing an empty string', () => {
    // The column's own CHECK refuses a blank value, so "no answer" must mean
    // no row rather than an empty one.
    const result = validateAnswers([requirement({ isRequired: false })], {
      years_of_residency: '',
    })

    expect(result.fieldErrors).toEqual({})
    expect(result.answers.size).toBe(0)
  })

  it('reports every bad answer at once rather than stopping at the first', () => {
    const result = validateAnswers(
      [
        requirement({ requirementId: 'r1', key: 'a', inputKind: 'number' }),
        requirement({ requirementId: 'r2', key: 'b', inputKind: 'date' }),
      ],
      { a: 'seven', b: 'yesterday' },
    )

    expect(Object.keys(result.fieldErrors)).toEqual([answerFieldName('a'), answerFieldName('b')])
  })
})

describe('validateAnswers — typed answers mirror the trigger', () => {
  it('refuses prose for a number', () => {
    const result = validateAnswers(
      [requirement({ inputKind: 'number', key: 'n', requirementId: 'r' })],
      { n: 'seven' },
    )
    expect(result.fieldErrors[answerFieldName('n')]?.[0]).toMatch(/enter a number/i)
  })

  it('accepts a negative and a decimal, as the trigger regex does', () => {
    for (const value of ['-3', '3.5']) {
      const result = validateAnswers(
        [requirement({ inputKind: 'number', key: 'n', requirementId: 'r' })],
        { n: value },
      )
      expect(result.fieldErrors).toEqual({})
    }
  })

  it('refuses a date that is not a real day', () => {
    const result = validateAnswers(
      [requirement({ inputKind: 'date', key: 'd', requirementId: 'r' })],
      { d: '2026-13-40' },
    )
    expect(result.fieldErrors[answerFieldName('d')]).toBeDefined()
  })

  it('refuses a choice outside a select requirement’s options', () => {
    const result = validateAnswers(
      [
        requirement({
          inputKind: 'select',
          key: 'use',
          requirementId: 'r',
          options: ['Employment', 'School'],
        }),
      ],
      { use: 'Astrology' },
    )
    expect(result.fieldErrors[answerFieldName('use')]?.[0]).toMatch(/listed options/i)
  })

  it('accepts a listed choice', () => {
    const result = validateAnswers(
      [
        requirement({
          inputKind: 'select',
          key: 'use',
          requirementId: 'r',
          options: ['Employment', 'School'],
        }),
      ],
      { use: 'School' },
    )
    expect(result.answers.get('r')).toBe('School')
  })

  it('accepts only yes/no for a boolean', () => {
    const bool = requirement({ inputKind: 'boolean', key: 'b', requirementId: 'r' })

    expect(validateAnswers([bool], { b: 'true' }).answers.get('r')).toBe('true')
    expect(validateAnswers([bool], { b: 'maybe' }).fieldErrors[answerFieldName('b')]).toBeDefined()
  })
})

describe('validateAnswers — nothing outside the declared requirements', () => {
  it('ignores a value posted for a key the document type never declared', () => {
    // The action reads by requirement, so a crafted field cannot introduce a
    // requirement id that does not belong to the type.
    const result = validateAnswers([requirement()], {
      years_of_residency: '12',
      smuggled: 'value',
    })

    expect(result.answers.size).toBe(1)
    expect(result.fieldErrors).toEqual({})
  })

  it('returns an empty set for a type that asks nothing', () => {
    const result = validateAnswers([], { anything: 'at all' })
    expect(result.answers.size).toBe(0)
    expect(result.fieldErrors).toEqual({})
  })
})

describe('requestActionSchema', () => {
  it('requires both an opaque request id and its tenant', () => {
    expect(
      requestActionSchema.safeParse({
        requestId: 'f2000000-0000-4000-8000-000000000001',
        barangayId: 'a0000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)
  })

  it('refuses anything that is not a uuid', () => {
    expect(
      requestActionSchema.safeParse({ requestId: 'my-request', barangayId: 'san-isidro' }).success,
    ).toBe(false)
  })
})
