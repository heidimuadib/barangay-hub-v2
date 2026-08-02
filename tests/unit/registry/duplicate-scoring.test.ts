import { describe, expect, it } from 'vitest'

import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  candidatePriority,
  isCandidateScore,
  normalizeName,
  similarityBand,
} from '@/features/registry/rules/duplicate-scoring'

describe('duplicate scoring rule', () => {
  it('pins the documented threshold that mirrors the SQL rule', () => {
    // Changing this value is a domain decision, not a refactor: the SQL in
    // duplicate_candidates() must change with it, and this test forces the
    // conversation.
    expect(DUPLICATE_SIMILARITY_THRESHOLD).toBe(0.3)
    expect(isCandidateScore(0.3)).toBe(true)
    expect(isCandidateScore(0.29)).toBe(false)
    expect(isCandidateScore(1)).toBe(true)
  })

  it('normalises names the way the database search text does', () => {
    expect(normalizeName('María  Sántos')).toBe('maria santos')
    expect(normalizeName('  JOSÉ  Rizal ')).toBe('jose rizal')
    expect(normalizeName('Peña')).toBe('pena')
  })

  it('prioritises same-birthdate candidates above name-only matches', () => {
    // A weaker name match WITH a birthdate match outranks a stronger
    // name-only match — order of review, never an automatic decision.
    expect(candidatePriority(0.4, true)).toBeGreaterThan(candidatePriority(0.9, false))
    expect(candidatePriority(0.5, false)).toBeGreaterThan(candidatePriority(0.4, false))
  })

  it('explains scores as bands, never decimals (Slice 2E)', () => {
    // Presentation buckets over the committed 0.30 floor: the accented seed
    // pair (María Sántos vs Maria Santos) normalises to identical text and
    // lands in the top band; the floor itself is only ever "possible".
    expect(similarityBand(1)).toBe('near_identical')
    expect(similarityBand(0.9)).toBe('near_identical')
    expect(similarityBand(0.89)).toBe('strong')
    expect(similarityBand(0.6)).toBe('strong')
    expect(similarityBand(0.59)).toBe('possible')
    expect(similarityBand(DUPLICATE_SIMILARITY_THRESHOLD)).toBe('possible')
  })
})
