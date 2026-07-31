import { ERROR_CODES, type ErrorCode } from './codes'

export type FieldErrors = Record<string, string[]>

export interface AppErrorOptions {
  /** Internal detail for logs. Never returned to a client. */
  readonly detail?: string
  readonly cause?: unknown
  readonly correlationId?: string
}

/**
 * Base class for every expected failure.
 *
 * Services throw these; the Server Action chain converts them into a `Result`
 * (Phase 6 §17.3). Unexpected throws are wrapped as `InfrastructureError` at the
 * boundary so that no internal message ever reaches a user.
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode
  /** True when the message is safe to display verbatim to an end user. */
  abstract readonly isUserFacing: boolean

  readonly detail: string | undefined
  readonly correlationId: string | undefined

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = new.target.name
    this.detail = options.detail
    this.correlationId = options.correlationId
    Error.captureStackTrace?.(this, new.target)
  }
}

/** Input was malformed. Carries per-field messages for the form layer. */
export class ValidationError extends AppError {
  readonly code = ERROR_CODES.VALIDATION_FAILED
  readonly isUserFacing = true
  readonly fieldErrors: FieldErrors

  constructor(message: string, fieldErrors: FieldErrors = {}, options: AppErrorOptions = {}) {
    super(message, options)
    this.fieldErrors = fieldErrors
  }
}

/**
 * A business rule refused the operation (BR-*). The message must follow the
 * three-part structure: what happened, why, what to do next (Phase 5 §3.3).
 */
export class BusinessRuleError extends AppError {
  readonly code = ERROR_CODES.BUSINESS_RULE_VIOLATED
  readonly isUserFacing = true
  /** e.g. 'BR-4'. Recorded in the audit entry, never displayed. */
  readonly ruleKey: string
  /** References the message may link to, e.g. an existing request. */
  readonly references: readonly string[]

  constructor(
    ruleKey: string,
    message: string,
    references: readonly string[] = [],
    options: AppErrorOptions = {},
  ) {
    super(message, options)
    this.ruleKey = ruleKey
    this.references = references
  }
}

export class AuthenticationError extends AppError {
  readonly code = ERROR_CODES.AUTHENTICATION_REQUIRED
  readonly isUserFacing = true
}

/**
 * Permission or resource predicate denied the operation.
 * Every instance is audited by the action chain (Phase 6 §24, Phase 4 §16.3).
 */
export class AuthorizationError extends AppError {
  readonly code = ERROR_CODES.AUTHORIZATION_DENIED
  readonly isUserFacing = true
  readonly permission: string | undefined

  constructor(message: string, permission?: string, options: AppErrorOptions = {}) {
    super(message, options)
    this.permission = permission
  }
}

/**
 * Not found, or found in another tenant.
 *
 * These are deliberately indistinguishable: a wrong-tenant request must not
 * reveal that the record exists (Phase 4 §13.6).
 */
export class NotFoundError extends AppError {
  readonly code = ERROR_CODES.NOT_FOUND
  readonly isUserFacing = true
}

/** A from-state guard or optimistic concurrency check rejected the transition. */
export class ConflictError extends AppError {
  readonly code = ERROR_CODES.CONFLICT
  readonly isUserFacing = true
  readonly currentState: string | undefined

  constructor(message: string, currentState?: string, options: AppErrorOptions = {}) {
    super(message, options)
    this.currentState = currentState
  }
}

export class RateLimitError extends AppError {
  readonly code = ERROR_CODES.RATE_LIMITED
  readonly isUserFacing = true
  readonly retryAfterSeconds: number

  constructor(message: string, retryAfterSeconds: number, options: AppErrorOptions = {}) {
    super(message, options)
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Same idempotency key presented with a different payload (Phase 4 §23.1). */
export class IdempotencyConflictError extends AppError {
  readonly code = ERROR_CODES.IDEMPOTENCY_KEY_REUSED
  readonly isUserFacing = false
}

/** Database, storage, email or other infrastructure failure. Always correlated. */
export class InfrastructureError extends AppError {
  readonly code = ERROR_CODES.INFRASTRUCTURE_FAILURE
  readonly isUserFacing = false
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError
}

/**
 * Wraps an unknown throw so that no internal message escapes.
 * The original is preserved on `cause` for the logger only.
 */
export function toAppError(value: unknown, correlationId?: string): AppError {
  if (isAppError(value)) return value
  const detail = value instanceof Error ? value.message : String(value)
  return new InfrastructureError('An unexpected error occurred.', {
    detail,
    cause: value,
    ...(correlationId === undefined ? {} : { correlationId }),
  })
}
