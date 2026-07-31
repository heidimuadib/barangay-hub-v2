export const REDACTED = '[redacted]'

/**
 * Keys whose values are secrets. Never logged under any circumstance.
 */
const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  /pass(word|wd)?$/i,
  /secret/i,
  /token/i,
  /^jwt/i,
  /api[_-]?key/i,
  /service[_-]?role/i,
  /anon[_-]?key/i,
  /authorization/i,
  /^set-?cookie$/i,
  /^cookie$/i,
  /credential/i,
  /private[_-]?key/i,
  /session[_-]?id/i,
]

/**
 * Keys carrying personal data. Phase 6 §37.2 — never logged.
 * The field NAME is retained (it is diagnostically useful); the VALUE is not.
 */
const PII_KEY_PATTERNS: readonly RegExp[] = [
  /^email/i,
  /email[_-]?normalized/i,
  /phone/i,
  /mobile/i,
  /full[_-]?name/i,
  /first[_-]?name/i,
  /last[_-]?name/i,
  /middle[_-]?name/i,
  /display[_-]?name/i,
  /holder[_-]?name/i,
  /respondent[_-]?name/i,
  /complainant[_-]?name/i,
  /received[_-]?by/i,
  /server[_-]?name/i,
  /birth[_-]?date/i,
  /birthdate/i,
  /^address/i,
  /street/i,
  /narrative/i,
  /description/i,
  /reason[_-]?note/i,
  /^notes?$/i,
  /remarks/i,
  /file[_-]?name/i,
  /original[_-]?filename/i,
  /search[_-]?(query|term)/i,
  /^q$/i,
  /^body$/i,
  /^title$/i,
]

const EMAIL_VALUE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PH_PHONE_VALUE = /\+63\d{10}\b/g
/** JWT-shaped strings, e.g. an accidentally interpolated access token. */
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g

const MAX_DEPTH = 6
const MAX_ARRAY_ITEMS = 50
const MAX_STRING_LENGTH = 2000

function matches(patterns: readonly RegExp[], key: string): boolean {
  return patterns.some((pattern) => pattern.test(key))
}

function redactString(value: string): string {
  const truncated =
    value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value
  return truncated
    .replace(JWT_VALUE, REDACTED)
    .replace(EMAIL_VALUE, REDACTED)
    .replace(PH_PHONE_VALUE, REDACTED)
}

/**
 * Deep-redacts a log payload.
 *
 * Redaction happens HERE, not at call sites — a new call site cannot forget
 * (Phase 6 §17.6). Circular references and unbounded structures are contained.
 */
export function redact(input: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (input === null || input === undefined) return input
  if (typeof input === 'string') return redactString(input)
  if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint') {
    return input
  }
  if (input instanceof Date) return input.toISOString()
  if (input instanceof Error) {
    return {
      name: input.name,
      message: redactString(input.message),
      stack: input.stack ? redactString(input.stack) : undefined,
    }
  }
  if (depth >= MAX_DEPTH) return '[max-depth]'

  if (Array.isArray(input)) {
    if (seen.has(input)) return '[circular]'
    seen.add(input)
    const items = input.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1, seen))
    if (input.length > MAX_ARRAY_ITEMS) {
      items.push(`[+${input.length - MAX_ARRAY_ITEMS} more]`)
    }
    return items
  }

  if (typeof input === 'object') {
    if (seen.has(input)) return '[circular]'
    seen.add(input)
    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (matches(SECRET_KEY_PATTERNS, key) || matches(PII_KEY_PATTERNS, key)) {
        output[key] = REDACTED
        continue
      }
      output[key] = redact(value, depth + 1, seen)
    }
    return output
  }

  return '[unserialisable]'
}
