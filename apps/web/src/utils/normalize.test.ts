import { describe, expect, it } from 'vitest'

import {
  MIN_SEARCH_LENGTH,
  isPlausibleBirthdate,
  isSearchable,
  normalizeContactPhone,
  normalizePersonName,
  normalizeSearchTerm,
} from './normalize'

describe('normalizePersonName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizePersonName('  Juan   Miguel  ')).toBe('Juan Miguel')
    expect(normalizePersonName('Juan\t\nMiguel')).toBe('Juan Miguel')
  })

  it('preserves particles, hyphens, apostrophes and case', () => {
    // Deliberate: "tidying" these corrupts the record the barangay holds.
    for (const name of ['dela Cruz', "O'Brien", 'Santos-Reyes', 'MacArthur', 'Ñíguez']) {
      expect(normalizePersonName(name)).toBe(name)
    }
  })
})

describe('normalizeContactPhone', () => {
  it('keeps digits and a single leading plus', () => {
    expect(normalizeContactPhone(' 0917 555 1234 ')).toBe('09175551234')
    expect(normalizeContactPhone('(02) 8123-4567')).toBe('0281234567')
    expect(normalizeContactPhone('+63 917 555 1234')).toBe('+639175551234')
  })

  it('does not guess a country code', () => {
    // 09… must NOT become +639… — staff may need to dial it exactly as given.
    expect(normalizeContactPhone('09175551234')).toBe('09175551234')
  })

  it('returns empty when nothing dialable remains', () => {
    expect(normalizeContactPhone('   ')).toBe('')
    expect(normalizeContactPhone('n/a')).toBe('')
    expect(normalizeContactPhone('+')).toBe('')
  })
})

describe('normalizeSearchTerm / isSearchable', () => {
  it('lowercases, strips diacritics and collapses whitespace', () => {
    expect(normalizeSearchTerm('  Dela   CRUZ ')).toBe('dela cruz')
    expect(normalizeSearchTerm('Ñíguez')).toBe('niguez')
    expect(normalizeSearchTerm('José')).toBe('jose')
  })

  it('applies the same floor the SQL function enforces', () => {
    expect(MIN_SEARCH_LENGTH).toBe(2)
    expect(isSearchable('a')).toBe(false)
    expect(isSearchable('  a  ')).toBe(false)
    expect(isSearchable('')).toBe(false)
    expect(isSearchable('ab')).toBe(true)
    // A single accented character is still one character after stripping.
    expect(isSearchable('é')).toBe(false)
  })
})

describe('isPlausibleBirthdate', () => {
  const today = new Date('2026-08-01T00:00:00Z')

  it('accepts a real past date', () => {
    expect(isPlausibleBirthdate('1990-02-28', today)).toBe(true)
    expect(isPlausibleBirthdate('2004-02-29', today)).toBe(true)
  })

  it('rejects malformed input', () => {
    expect(isPlausibleBirthdate('01-08-1990', today)).toBe(false)
    expect(isPlausibleBirthdate('1990-2-8', today)).toBe(false)
    expect(isPlausibleBirthdate('not a date', today)).toBe(false)
  })

  it('rejects dates that roll over rather than exist', () => {
    // Date() would silently turn these into March.
    expect(isPlausibleBirthdate('2026-02-31', today)).toBe(false)
    expect(isPlausibleBirthdate('2025-02-29', today)).toBe(false)
    expect(isPlausibleBirthdate('1990-13-01', today)).toBe(false)
  })

  it('accepts today but rejects the future', () => {
    expect(isPlausibleBirthdate('2026-08-01', today)).toBe(true)
    expect(isPlausibleBirthdate('2026-08-02', today)).toBe(false)
  })

  it('refuses ages beyond 130 as data-entry errors', () => {
    expect(isPlausibleBirthdate('1896-08-01', today)).toBe(true)
    expect(isPlausibleBirthdate('1896-07-31', today)).toBe(false)
  })
})
