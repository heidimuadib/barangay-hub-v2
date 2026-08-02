/**
 * Application-level rate limiting seam.
 *
 * Option C (ADR-0006) introduces the project's first anonymous write surface,
 * and point 13 requires rate limiting before hosted public exposure. This
 * module is the seam that requirement hangs on: a small interface plus an
 * in-memory sliding-window implementation that is correct for a single
 * process.
 *
 * IT IS DELIBERATELY NOT SUFFICIENT FOR HOSTED EXPOSURE. Counters live in
 * process memory, so N server instances multiply every quota by N and a cold
 * start forgets everything. Activating hosted public sign-up requires a
 * shared store (Postgres table or Redis) behind this same interface — the
 * swap is one `RateLimiter` implementation, no call-site changes. Tracked as
 * R-1-04; nothing here marks hosted exposure as safe.
 */

export interface RateLimitDecision {
  readonly allowed: boolean
  /** Seconds until the caller may retry. Zero when allowed. */
  readonly retryAfterSeconds: number
}

export interface RateLimiter {
  /**
   * `key` must never contain personal data — callers pass a digest or an
   * opaque identifier, never an email address.
   */
  check(key: string): RateLimitDecision
}

export interface RateLimitOptions {
  /** Requests permitted within the window. */
  readonly limit: number
  readonly windowSeconds: number
  /** Injectable clock; production passes none and gets Date.now. */
  readonly now?: () => number
  /** Guards unbounded growth from a key-space flood. */
  readonly maxKeys?: number
}

const DEFAULT_MAX_KEYS = 10_000

export function createInMemoryRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowSeconds } = options
  const now = options.now ?? (() => Date.now())
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS
  const windowMs = windowSeconds * 1000
  const hits = new Map<string, number[]>()

  return {
    check(key: string): RateLimitDecision {
      const currentTime = now()
      const cutoff = currentTime - windowMs

      const recent = (hits.get(key) ?? []).filter((stamp) => stamp > cutoff)

      if (recent.length >= limit) {
        // Oldest surviving hit determines when a slot frees up.
        const oldest = recent[0] ?? currentTime
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - currentTime) / 1000))
        hits.set(key, recent)
        return { allowed: false, retryAfterSeconds }
      }

      recent.push(currentTime)
      hits.set(key, recent)

      // Opportunistic sweep: without it a flood of distinct keys would grow
      // the map without bound, which is its own denial-of-service.
      if (hits.size > maxKeys) {
        for (const [existingKey, stamps] of hits) {
          const surviving = stamps.filter((stamp) => stamp > cutoff)
          if (surviving.length === 0) hits.delete(existingKey)
          else hits.set(existingKey, surviving)
          if (hits.size <= maxKeys) break
        }
      }

      return { allowed: true, retryAfterSeconds: 0 }
    },
  }
}
