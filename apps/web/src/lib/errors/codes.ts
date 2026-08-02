/**
 * Stable, machine-readable error codes.
 *
 * These cross the server/client boundary inside the `Result` envelope. They are
 * NEVER shown to a user — the UI maps a code to approved copy (Phase 5 §36).
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BUSINESS_RULE_VIOLATED: 'BUSINESS_RULE_VIOLATED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  INFRASTRUCTURE_FAILURE: 'INFRASTRUCTURE_FAILURE',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** Advisory HTTP status for route handlers. Server Actions return a Result instead. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  BUSINESS_RULE_VIOLATED: 422,
  AUTHENTICATION_REQUIRED: 401,
  AUTHORIZATION_DENIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  IDEMPOTENCY_KEY_REUSED: 409,
  INFRASTRUCTURE_FAILURE: 500,
}
