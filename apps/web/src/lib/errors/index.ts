export {
  AppError,
  AuthenticationError,
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  IdempotencyConflictError,
  InfrastructureError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  isAppError,
  toAppError,
  type AppErrorOptions,
  type FieldErrors,
} from './app-error'

export { ERROR_CODES, ERROR_STATUS, type ErrorCode } from './codes'

export { fail, isFail, isOk, ok, resultFromError, type Result, type ResultError } from './result'
