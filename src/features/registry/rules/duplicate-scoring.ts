/**
 * Duplicate-candidate domain rule (ADR-0006 points 9–10).
 *
 * The authoritative implementation is SQL (`duplicate_candidates`, migration
 * 20260802030000): pg_trgm similarity over lower(unaccent(names)) with the
 * threshold below. This mirror documents the rule, lets the UI explain
 * scores, and keeps the threshold unit-tested. The SQL value governs.
 *
 * Candidates are SIGNALS for manual review — names and birthdates are never
 * conclusive identity proof, and nothing merges automatically.
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.3

/**
 * Client-side approximation of lower(unaccent(text)): strips combining
 * diacritics via NFD normalisation. Postgres' unaccent dictionary is broader;
 * for the Latin-script names this registry holds, the two agree.
 */
export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function isCandidateScore(similarity: number): boolean {
  return similarity >= DUPLICATE_SIMILARITY_THRESHOLD
}

/**
 * Review-priority bucket for the staff UI: a same-birthdate candidate always
 * outranks a name-only candidate of equal similarity. Presentation order
 * only — never an automatic decision.
 */
export function candidatePriority(similarity: number, sameBirthdate: boolean): number {
  return similarity + (sameBirthdate ? 1 : 0)
}
