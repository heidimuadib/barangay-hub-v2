import { describe, expect, it } from 'vitest'

import {
  VERIFICATION_TOKEN_ENTROPY_BITS,
  VERIFICATION_TOKEN_LENGTH,
  isValidVerificationToken,
  looksNonSequential,
  normalizeVerificationToken,
} from '@/features/certificates/rules/verification-token'

const VALID = 'a'.repeat(64)

describe('token shape', () => {
  it('accepts 64 lower-case hex characters', () => {
    expect(isValidVerificationToken(VALID)).toBe(true)
    expect(isValidVerificationToken('0123456789abcdef'.repeat(4))).toBe(true)
  })

  it('rejects anything shorter or longer', () => {
    expect(isValidVerificationToken('a'.repeat(63))).toBe(false)
    expect(isValidVerificationToken('a'.repeat(65))).toBe(false)
    expect(isValidVerificationToken('')).toBe(false)
  })

  it('rejects non-hex characters', () => {
    expect(isValidVerificationToken('g'.repeat(64))).toBe(false)
    expect(isValidVerificationToken(`${'a'.repeat(63)}-`)).toBe(false)
  })

  it('rejects upper case, because the stored form is lower case', () => {
    // Not pedantry: an equality lookup that accepted both would need either a
    // second index or a scan, and this is the query a public endpoint runs.
    expect(isValidVerificationToken('A'.repeat(64))).toBe(false)
  })

  it('rejects a uuid — a certificate id is not a verification token', () => {
    // The distinction that matters: an internal id must never work as a public
    // lookup key, or the verification endpoint becomes reachable by anyone who
    // has seen an id anywhere else.
    expect(isValidVerificationToken('c3000000-0000-4000-8000-000000000001')).toBe(false)
  })

  it('rejects injection-shaped input outright, before it reaches a query', () => {
    expect(isValidVerificationToken("' or 1=1 --")).toBe(false)
    expect(isValidVerificationToken(`${'a'.repeat(60)}%'--`)).toBe(false)
  })

  it('states its own length', () => {
    expect(VERIFICATION_TOKEN_LENGTH).toBe(64)
    expect(VALID).toHaveLength(VERIFICATION_TOKEN_LENGTH)
  })
})

describe('normalisation', () => {
  it('lower-cases what a scanner or a person produced', () => {
    expect(normalizeVerificationToken('A'.repeat(64))).toBe(VALID)
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeVerificationToken(`  ${VALID}\n`)).toBe(VALID)
  })

  it('turns transcription variation into something valid', () => {
    const typed = `  ${'AB'.repeat(32)}  `
    expect(isValidVerificationToken(typed)).toBe(false)
    expect(isValidVerificationToken(normalizeVerificationToken(typed))).toBe(true)
  })

  it('does not rescue genuinely wrong input', () => {
    // Normalising must not become a way to accept a malformed token.
    expect(isValidVerificationToken(normalizeVerificationToken('not a token'))).toBe(false)
    expect(isValidVerificationToken(normalizeVerificationToken('a'.repeat(63)))).toBe(false)
  })

  it('leaves an already canonical token untouched', () => {
    expect(normalizeVerificationToken(VALID)).toBe(VALID)
  })
})

describe('entropy expectations', () => {
  it('records 32 bytes of entropy, which is what makes a bare-token lookup safe', () => {
    expect(VERIFICATION_TOKEN_ENTROPY_BITS).toBe(256)
    expect(VERIFICATION_TOKEN_ENTROPY_BITS).toBe((VERIFICATION_TOKEN_LENGTH / 2) * 8)
  })
})

describe('sequential-token detection', () => {
  it('accepts a single token, having nothing to compare', () => {
    expect(looksNonSequential([VALID])).toBe(true)
  })

  it('accepts tokens that share nothing', () => {
    expect(
      looksNonSequential([
        '3f8a1c9e2b7d4056f1a3c5e7b9d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6',
        'b1d3f5a7c9e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2',
      ]),
    ).toBe(true)
  })

  it('rejects duplicates outright', () => {
    expect(looksNonSequential([VALID, VALID])).toBe(false)
  })

  it('rejects tokens that share a long prefix — the shape a counter produces', () => {
    // What this actually catches: someone replacing gen_random_bytes with a
    // hash of the id, the serial, or an incrementing value. Real random pairs
    // do not agree on eight hex characters.
    const stem = 'deadbeefcafef00d'.repeat(3)
    expect(looksNonSequential([`${stem}0000000000000001`, `${stem}0000000000000002`])).toBe(false)
  })

  it('tolerates a short accidental prefix', () => {
    expect(
      looksNonSequential([
        'ab1c9e2b7d4056f1a3c5e7b9d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8',
        'ab3f5a7c9e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f',
      ]),
    ).toBe(true)
  })

  it('catches a bad generator hiding among good tokens', () => {
    const stem = 'deadbeefcafef00d'.repeat(3)
    expect(
      looksNonSequential([
        `${stem}0000000000000001`,
        'b1d3f5a7c9e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2',
        `${stem}0000000000000002`,
      ]),
    ).toBe(false)
  })

  it('accepts an empty set', () => {
    expect(looksNonSequential([])).toBe(true)
  })
})
