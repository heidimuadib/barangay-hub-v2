import { RESIDENCY_BASES } from '../constants'
import type { ResidencyBasisKey } from '../types/registry'

/**
 * D2-01 rules over the vocabulary defined in constants (ADR-0006). The
 * database enum and catalog are authoritative; pgTAP proves the enforcement.
 */
export { RESIDENCY_BASES }

export const RESIDENCY_BASIS_KEYS = Object.keys(RESIDENCY_BASES) as ResidencyBasisKey[]

export function requiresExplanation(key: ResidencyBasisKey): boolean {
  return RESIDENCY_BASES[key].requiresExplanation
}

/** Fail-closed validation used by schemas and (later) forms. */
export function isResidencyValid(
  key: ResidencyBasisKey,
  explanation: string | null | undefined,
): boolean {
  const trimmed = explanation?.trim() ?? ''
  if (requiresExplanation(key)) {
    return trimmed.length > 0 && trimmed.length <= 500
  }
  return trimmed.length === 0
}
