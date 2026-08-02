import {
  BusinessRuleError,
  ConflictError,
  RateLimitError,
  ValidationError,
  isAppError,
  type AppError,
  type FieldErrors,
} from './app-error'
import { type ErrorCode } from './codes'

/**
 * Error payload crossing the server/client boundary.
 * Contains no stack trace, no internal detail, and no PII.
 */
export interface ResultError {
  readonly code: ErrorCode
  /** Safe to display, or a generic fallback when the error is not user-facing. */
  readonly message: string
  readonly fieldErrors?: FieldErrors
  /** Present for infrastructure failures so support can find the log entry. */
  readonly correlationId?: string
  readonly retryAfterSeconds?: number
  /** Human references the UI may link to, e.g. ['DOC-2026-000123']. */
  readonly references?: readonly string[]
  /** Current state when a transition was rejected. */
  readonly currentState?: string
}

export type Result<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: ResultError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function fail<T = never>(error: ResultError): Result<T> {
  return { ok: false, error }
}

const GENERIC_MESSAGE =
  'Something went wrong on our end. Please try again. If it keeps happening, contact the barangay office and give them the reference below.'

/**
 * Converts a thrown `AppError` into a client-safe `Result`.
 * Called once, by the Server Action chain — never by feature code.
 */
export function resultFromError<T = never>(error: unknown, correlationId?: string): Result<T> {
  if (!isAppError(error)) {
    return fail({
      code: 'INFRASTRUCTURE_FAILURE',
      message: GENERIC_MESSAGE,
      ...(correlationId === undefined ? {} : { correlationId }),
    })
  }

  const appError: AppError = error

  /**
   * A correlation ID is attached only when the message is generic.
   *
   * The generic copy tells the user to quote a reference, so it is useless
   * without one. A user-facing message ("you already have a pending request")
   * is self-explanatory, and showing a support reference alongside it makes an
   * ordinary, expected outcome look like a system fault.
   */
  const resolvedCorrelationId = appError.isUserFacing
    ? undefined
    : (appError.correlationId ?? correlationId)

  // Every branch below spreads `base`, so the correlation-ID policy is applied
  // once rather than being repeated — and cannot be forgotten by a new branch.
  const base = {
    code: appError.code,
    message: appError.isUserFacing ? appError.message : GENERIC_MESSAGE,
    ...(resolvedCorrelationId === undefined ? {} : { correlationId: resolvedCorrelationId }),
  }

  if (appError instanceof ValidationError) {
    return fail({ ...base, fieldErrors: appError.fieldErrors })
  }
  if (appError instanceof BusinessRuleError) {
    return fail({ ...base, references: appError.references })
  }
  if (appError instanceof ConflictError) {
    return fail({
      ...base,
      ...(appError.currentState === undefined ? {} : { currentState: appError.currentState }),
    })
  }
  if (appError instanceof RateLimitError) {
    return fail({ ...base, retryAfterSeconds: appError.retryAfterSeconds })
  }
  // IdempotencyConflictError, AuthorizationError, AuthenticationError,
  // NotFoundError and InfrastructureError carry no extra client-visible payload:
  // the code and the approved message are all the UI needs, and anything more
  // would disclose internal detail.
  return fail({ ...base })
}

/** Narrowing helpers for consumers. */
export function isOk<T>(result: Result<T>): result is { ok: true; data: T } {
  return result.ok
}

export function isFail<T>(result: Result<T>): result is { ok: false; error: ResultError } {
  return !result.ok
}
