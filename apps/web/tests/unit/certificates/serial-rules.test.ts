import { describe, expect, it } from 'vitest'

import {
  assessLedger,
  formatSerial,
  isSerialConfirmed,
  nextSequence,
  type SerialLedgerEntry,
} from '@/features/certificates/rules/serial'

describe('serial rendering', () => {
  it('renders prefix, year and a zero-padded sequence', () => {
    expect(formatSerial({ prefix: 'SI', year: 2026, sequence: 7, width: 5 })).toBe('SI-2026-00007')
  })

  it('pads to the configured width and never truncates past it', () => {
    expect(formatSerial({ prefix: 'SI', year: 2026, sequence: 1, width: 3 })).toBe('SI-2026-001')
    // A book that outgrows its padding must keep NUMBERING correctly rather
    // than wrap or clip: the number is the accountable thing, the width is
    // cosmetic. 123456 in a 3-wide book renders wide, not as '456'.
    expect(formatSerial({ prefix: 'SI', year: 2026, sequence: 123456, width: 3 })).toBe(
      'SI-2026-123456',
    )
  })

  it('is a pure function of its inputs — the same parts always render the same', () => {
    const parts = { prefix: 'MAL', year: 2026, sequence: 42, width: 5 }
    expect(formatSerial(parts)).toBe(formatSerial(parts))
  })

  it('keeps different books distinguishable', () => {
    const si = formatSerial({ prefix: 'SI', year: 2026, sequence: 1, width: 5 })
    const mal = formatSerial({ prefix: 'MAL', year: 2026, sequence: 1, width: 5 })
    const lastYear = formatSerial({ prefix: 'SI', year: 2025, sequence: 1, width: 5 })
    expect(new Set([si, mal, lastYear]).size).toBe(3)
  })
})

describe('placeholder marking', () => {
  it('treats an unconfirmed format as unconfirmed', () => {
    expect(isSerialConfirmed({ sequence: 1, display: 'SI-2026-00001', isPlaceholder: true })).toBe(
      false,
    )
  })

  it('and a confirmed one as confirmed', () => {
    expect(isSerialConfirmed({ sequence: 1, display: 'SI-2026-00001', isPlaceholder: false })).toBe(
      true,
    )
  })

  it('reads the flag, never the string — a real-looking serial is not an approved one', () => {
    // The failure this guards: someone seeds a plausible format and a surface
    // starts treating "looks official" as "is official".
    expect(
      isSerialConfirmed({
        sequence: 1,
        display: 'BRGY-SI-2026-00001-OFFICIAL',
        isPlaceholder: true,
      }),
    ).toBe(false)
  })
})

describe('serial accountability', () => {
  const entry = (sequence: number, voided = false): SerialLedgerEntry => ({ sequence, voided })

  it('calls an unused book complete', () => {
    expect(assessLedger([])).toBe('complete')
  })

  it('calls a gapless book complete', () => {
    expect(assessLedger([entry(1), entry(2), entry(3)])).toBe('complete')
  })

  it('is unaffected by the order rows arrive in', () => {
    expect(assessLedger([entry(3), entry(1), entry(2)])).toBe('complete')
  })

  it('counts a VOIDED certificate as accounted for — its number stays consumed', () => {
    // This is the whole point of keeping the row. The certificate is withdrawn
    // but serial 2 was used, and the book can still say so.
    expect(assessLedger([entry(1), entry(2, true), entry(3)])).toBe('complete')
  })

  it('reports a missing number as unexplained', () => {
    // Serial 2 is simply absent — no certificate, no void record. This is the
    // state that must never occur, and the reason deletion is refused at the
    // table rather than merely discouraged in review.
    expect(assessLedger([entry(1), entry(3)])).toBe('unexplained')
  })

  it('reports a gap even when everything around it was voided', () => {
    expect(assessLedger([entry(1, true), entry(3, true)])).toBe('unexplained')
  })

  it('detects a book that never issued serial 1', () => {
    expect(assessLedger([entry(2), entry(3)])).toBe('unexplained')
  })

  it('detects a single missing number in a long run', () => {
    const entries = Array.from({ length: 200 }, (_, index) => entry(index + 1)).filter(
      (candidate) => candidate.sequence !== 137,
    )
    expect(assessLedger(entries)).toBe('unexplained')
  })
})

describe('next sequence', () => {
  it('reads the counter, not the issued rows', () => {
    expect(nextSequence(5)).toBe(5)
  })

  it('stays ahead of a deleted tail — the failure the counter exists to prevent', () => {
    // If certificate 4 vanished, max(sequence) + 1 would hand out 4 again and
    // two documents would carry the same number. The counter does not care
    // what rows survive.
    const counterAfterFourIssuances = 5
    const survivingSequences = [1, 2, 3]
    expect(nextSequence(counterAfterFourIssuances)).toBeGreaterThan(
      Math.max(...survivingSequences) + 1,
    )
  })
})
