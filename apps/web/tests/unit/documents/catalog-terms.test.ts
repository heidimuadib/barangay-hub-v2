import { describe, expect, it } from 'vitest'

import {
  formatFee,
  formatSla,
  formatValidity,
  presentTerms,
  requiresPlaceholderNotice,
  termStatus,
} from '@/features/documents/rules/catalog-terms'
import type { CatalogTerms } from '@/features/documents/types/documents'

const terms = (overrides: Partial<CatalogTerms> = {}): CatalogTerms => ({
  feeAmount: 50,
  feeCurrency: 'PHP',
  slaDays: 3,
  validityDays: 180,
  valuesArePlaceholder: true,
  ...overrides,
})

describe('term status (blocker B-08)', () => {
  it('separates "nobody decided" from "decided to be free"', () => {
    // This distinction is the whole point: rendering an undecided fee as ₱0.00
    // would quote a price the barangay never set.
    expect(termStatus(null, true)).toBe('undecided')
    expect(termStatus(0, true)).toBe('provisional')
    expect(termStatus(0, false)).toBe('confirmed')
  })

  it('marks any figure provisional while the placeholder flag stands', () => {
    expect(termStatus(50, true)).toBe('provisional')
    expect(termStatus(50, false)).toBe('confirmed')
  })
})

describe('placeholder notice', () => {
  it('is required whenever the row is flagged, whatever the figures say', () => {
    expect(requiresPlaceholderNotice(terms())).toBe(true)
  })

  it('is still required when a figure is simply missing', () => {
    // Even a confirmed catalog has nothing honest to say about a null value.
    expect(requiresPlaceholderNotice(terms({ valuesArePlaceholder: false, feeAmount: null }))).toBe(
      true,
    )
    expect(requiresPlaceholderNotice(terms({ valuesArePlaceholder: false, slaDays: null }))).toBe(
      true,
    )
    expect(
      requiresPlaceholderNotice(terms({ valuesArePlaceholder: false, validityDays: null })),
    ).toBe(true)
  })

  it('is dropped only when every figure is present AND confirmed', () => {
    expect(requiresPlaceholderNotice(terms({ valuesArePlaceholder: false }))).toBe(false)
  })
})

describe('formatting', () => {
  it('returns null rather than a misleading zero when no fee is set', () => {
    expect(formatFee(null, 'PHP')).toBeNull()
  })

  it('formats a free document as a real amount, because free is a decision', () => {
    expect(formatFee(0, 'PHP')).toContain('0.00')
  })

  it('formats an amount in the row’s currency', () => {
    const formatted = formatFee(50, 'PHP')
    expect(formatted).toContain('50.00')
  })

  it('describes turnaround in plain language', () => {
    expect(formatSla(null)).toBeNull()
    expect(formatSla(0)).toBe('Same day')
    expect(formatSla(1)).toBe('1 working day')
    expect(formatSla(3)).toBe('3 working days')
  })

  it('describes validity in the largest natural unit', () => {
    expect(formatValidity(null)).toBeNull()
    expect(formatValidity(365)).toBe('1 year')
    expect(formatValidity(730)).toBe('2 years')
    expect(formatValidity(30)).toBe('1 month')
    expect(formatValidity(90)).toBe('3 months')
    expect(formatValidity(1)).toBe('1 day')
    expect(formatValidity(45)).toBe('45 days')
  })
})

describe('presentTerms', () => {
  it('carries the notice alongside the figures, so a surface cannot show one without the other', () => {
    const presented = presentTerms(terms())
    expect(presented.fee).toContain('50.00')
    expect(presented.feeStatus).toBe('provisional')
    expect(presented.sla).toBe('3 working days')
    expect(presented.validity).toBe('6 months')
    expect(presented.showPlaceholderNotice).toBe(true)
  })

  it('reports undecided figures as null with an undecided status', () => {
    const presented = presentTerms(terms({ feeAmount: null, slaDays: null, validityDays: null }))
    expect(presented.fee).toBeNull()
    expect(presented.feeStatus).toBe('undecided')
    expect(presented.slaStatus).toBe('undecided')
    expect(presented.validityStatus).toBe('undecided')
    expect(presented.showPlaceholderNotice).toBe(true)
  })
})
