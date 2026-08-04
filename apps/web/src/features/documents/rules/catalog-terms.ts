import type { CatalogTerms } from '../types/documents'

/**
 * Presenting UNCONFIRMED commercial terms honestly (blocker B-08, placeholder
 * register RES-06, Phase 6 §2.7).
 *
 * The rule this file exists to enforce: a barangay has not confirmed its fee
 * schedule, turnaround times or validity periods, so no screen may render a
 * figure in a way that reads as official. Two failure modes are equally bad —
 * showing `₱50.00` as if it were settled, and showing `₱0.00` because the
 * value was missing. Both are prevented here rather than in each component,
 * so every surface tells the same truth.
 */

/** A value that has no confirmed figure at all — distinct from a free one. */
export const UNDECIDED = 'undecided' as const

/** A confirmed-by-the-barangay figure. Not reachable while B-08 is open. */
export const CONFIRMED = 'confirmed' as const

/** A figure that exists but awaits owner confirmation. */
export const PROVISIONAL = 'provisional' as const

export type TermStatus = typeof UNDECIDED | typeof PROVISIONAL | typeof CONFIRMED

/**
 * Classifies one figure.
 *
 * `null` means nobody has decided yet, which is NOT the same as a decided
 * value of zero — a free document is a real answer and must be able to say so.
 */
export function termStatus(value: number | null, valuesArePlaceholder: boolean): TermStatus {
  if (value === null) return UNDECIDED
  return valuesArePlaceholder ? PROVISIONAL : CONFIRMED
}

/** True when ANY figure on this type still needs owner confirmation. */
export function requiresPlaceholderNotice(terms: CatalogTerms): boolean {
  if (terms.valuesArePlaceholder) return true
  return terms.feeAmount === null || terms.slaDays === null || terms.validityDays === null
}

/**
 * Formats a fee for display.
 *
 * Returns `null` when there is nothing honest to show, so callers must render
 * their own "not set" affordance rather than receiving a zero that looks like
 * a price. A free document formats as a real amount, because free is a
 * decision, not an absence.
 */
export function formatFee(amount: number | null, currency: string): string | null {
  if (amount === null) return null
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Plain-language turnaround. Null when no promise has been made. */
export function formatSla(slaDays: number | null): string | null {
  if (slaDays === null) return null
  if (slaDays === 0) return 'Same day'
  return slaDays === 1 ? '1 working day' : `${slaDays} working days`
}

/** Plain-language validity. Null when no period has been set. */
export function formatValidity(validityDays: number | null): string | null {
  if (validityDays === null) return null
  if (validityDays % 365 === 0) {
    const years = validityDays / 365
    return years === 1 ? '1 year' : `${years} years`
  }
  if (validityDays % 30 === 0) {
    const months = validityDays / 30
    return months === 1 ? '1 month' : `${months} months`
  }
  return validityDays === 1 ? '1 day' : `${validityDays} days`
}

/**
 * Everything a catalog surface needs to render one type's terms honestly, in
 * one pass — so a component cannot accidentally render the amount while
 * forgetting the notice that qualifies it.
 */
export interface PresentedTerms {
  readonly fee: string | null
  readonly feeStatus: TermStatus
  readonly sla: string | null
  readonly slaStatus: TermStatus
  readonly validity: string | null
  readonly validityStatus: TermStatus
  readonly showPlaceholderNotice: boolean
}

export function presentTerms(terms: CatalogTerms): PresentedTerms {
  return {
    fee: formatFee(terms.feeAmount, terms.feeCurrency),
    feeStatus: termStatus(terms.feeAmount, terms.valuesArePlaceholder),
    sla: formatSla(terms.slaDays),
    slaStatus: termStatus(terms.slaDays, terms.valuesArePlaceholder),
    validity: formatValidity(terms.validityDays),
    validityStatus: termStatus(terms.validityDays, terms.valuesArePlaceholder),
    showPlaceholderNotice: requiresPlaceholderNotice(terms),
  }
}
