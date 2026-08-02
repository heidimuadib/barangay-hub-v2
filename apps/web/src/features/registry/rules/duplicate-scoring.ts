import type { SimilarityBand } from '../types/registry'

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
 *
 * The combining-mark range is written as an ESCAPE, not literal characters —
 * the raw form is invisible in an editor and does not survive a re-encode
 * (the same hardening `src/utils/normalize.ts` received in 2C).
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
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

// ── Score explanation (Slice 2E) ────────────────────────────────────────────
// The SimilarityBand type lives in ../types/registry so components may
// reference it (feature-component may import feature-type but not
// feature-rule — Phase 6 §16.1).

export type { SimilarityBand }

/**
 * The safe explanation of a trigram score, for the review surface.
 *
 * Bands, not decimals: a raw similarity number invites treating the signal as
 * evidence, and ADR-0006 points 9–10 are explicit that names are never
 * identity proof. The bands say how alike the NAMES are and nothing more;
 * the birthdate signal is shown separately, and the decision is always the
 * reviewer's. Cutoffs are presentation buckets over the committed 0.30 floor
 * — the SQL threshold governs which candidates exist at all.
 */
export function similarityBand(similarity: number): SimilarityBand {
  if (similarity >= 0.9) return 'near_identical'
  if (similarity >= 0.6) return 'strong'
  return 'possible'
}
