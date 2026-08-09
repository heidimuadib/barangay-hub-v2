import { describe, expect, it } from 'vitest'

import { formatRoleLabel, formatRoleList } from './format'

describe('formatRoleLabel', () => {
  it('turns a snake_case role key into readable text', () => {
    expect(formatRoleLabel('barangay_administrator')).toBe('Barangay administrator')
  })

  it('uses sentence case, not Title Case', () => {
    // "Barangay Administrator" reads as a proper noun — a specific office
    // rather than a description of what this person may do.
    expect(formatRoleLabel('barangay_clerk')).toBe('Barangay clerk')
  })

  it('handles a single-word role', () => {
    expect(formatRoleLabel('captain')).toBe('Captain')
  })

  it('handles hyphens as well as underscores', () => {
    expect(formatRoleLabel('records-officer')).toBe('Records officer')
  })

  it('collapses repeated separators', () => {
    expect(formatRoleLabel('barangay__health_worker')).toBe('Barangay health worker')
  })

  it('returns the original value when there is nothing to format', () => {
    expect(formatRoleLabel('')).toBe('')
    expect(formatRoleLabel('_')).toBe('_')
  })

  it('leaves an already-readable label alone apart from its first letter', () => {
    expect(formatRoleLabel('treasurer')).toBe('Treasurer')
  })
})

describe('formatRoleList', () => {
  it('joins multiple roles', () => {
    expect(formatRoleList(['barangay_clerk', 'records_officer'])).toBe(
      'Barangay clerk, Records officer',
    )
  })

  it('returns an empty string for no roles', () => {
    expect(formatRoleList([])).toBe('')
  })

  it('formats a single role', () => {
    expect(formatRoleList(['barangay_administrator'])).toBe('Barangay administrator')
  })
})
