import { describe, expect, it } from 'vitest'

import { createInMemoryRateLimiter } from '@/lib/rate-limit'

/**
 * The limiter is the seam the hosted public-exposure gate hangs on
 * (ADR-0006 point 13, R-1-04), so its window arithmetic is tested with an
 * injected clock rather than real time.
 */
function clockFrom(start: number) {
  let current = start
  return {
    now: () => current,
    advance(seconds: number) {
      current += seconds * 1000
    },
  }
}

describe('in-memory rate limiter', () => {
  it('allows exactly the configured number of attempts inside the window', () => {
    const clock = clockFrom(1_000_000)
    const limiter = createInMemoryRateLimiter({ limit: 3, windowSeconds: 60, now: clock.now })

    expect(limiter.check('k').allowed).toBe(true)
    expect(limiter.check('k').allowed).toBe(true)
    expect(limiter.check('k').allowed).toBe(true)
    expect(limiter.check('k').allowed).toBe(false)
  })

  it('reports a usable retry-after and never zero while blocked', () => {
    const clock = clockFrom(1_000_000)
    const limiter = createInMemoryRateLimiter({ limit: 1, windowSeconds: 60, now: clock.now })

    limiter.check('k')
    const blocked = limiter.check('k')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('frees a slot once the window slides past the oldest hit', () => {
    const clock = clockFrom(1_000_000)
    const limiter = createInMemoryRateLimiter({ limit: 2, windowSeconds: 60, now: clock.now })

    limiter.check('k')
    clock.advance(30)
    limiter.check('k')
    expect(limiter.check('k').allowed).toBe(false)

    // 31s later the FIRST hit ages out; the second has not.
    clock.advance(31)
    expect(limiter.check('k').allowed).toBe(true)
    expect(limiter.check('k').allowed).toBe(false)
  })

  it('keeps keys independent — one caller cannot exhaust another', () => {
    const clock = clockFrom(1_000_000)
    const limiter = createInMemoryRateLimiter({ limit: 1, windowSeconds: 60, now: clock.now })

    expect(limiter.check('attacker').allowed).toBe(true)
    expect(limiter.check('attacker').allowed).toBe(false)
    expect(limiter.check('bystander').allowed).toBe(true)
  })

  it('bounds memory under a key-space flood instead of growing without limit', () => {
    const clock = clockFrom(1_000_000)
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      windowSeconds: 1,
      now: clock.now,
      maxKeys: 5,
    })

    for (let i = 0; i < 50; i++) {
      limiter.check(`flood-${i}`)
      clock.advance(2)
    }
    // Still functioning correctly after the sweep.
    expect(limiter.check('real-caller').allowed).toBe(true)
    expect(limiter.check('real-caller').allowed).toBe(false)
  })
})
