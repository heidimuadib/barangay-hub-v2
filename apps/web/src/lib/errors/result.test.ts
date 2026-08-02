import { describe, expect, it } from 'vitest'

import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  IdempotencyConflictError,
  InfrastructureError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  toAppError,
} from './app-error'
import { fail, isFail, isOk, ok, resultFromError } from './result'

describe('Result', () => {
  it('narrows on ok and fail', () => {
    const success = ok({ id: 'abc' })
    const failure = fail<{ id: string }>({ code: 'NOT_FOUND', message: 'nope' })

    expect(isOk(success)).toBe(true)
    expect(isFail(failure)).toBe(true)
    if (success.ok) expect(success.data.id).toBe('abc')
    if (!failure.ok) expect(failure.error.code).toBe('NOT_FOUND')
  })
})

describe('resultFromError', () => {
  it('passes through user-facing validation messages with field errors', () => {
    const result = resultFromError(
      new ValidationError('Check the highlighted fields.', { birthDate: ['Required'] }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_FAILED')
    expect(result.error.message).toBe('Check the highlighted fields.')
    expect(result.error.fieldErrors?.['birthDate']).toEqual(['Required'])
  })

  it('carries business-rule references without exposing the rule key', () => {
    const result = resultFromError(
      new BusinessRuleError(
        'BR-4',
        'You already have a pending request for this document.',
        ['DOC-2026-000123'],
        { detail: 'internal only' },
      ),
    )

    if (result.ok) return
    expect(result.error.code).toBe('BUSINESS_RULE_VIOLATED')
    expect(result.error.references).toEqual(['DOC-2026-000123'])
    // The rule key is for the audit trail, not for the resident.
    expect(JSON.stringify(result.error)).not.toContain('BR-4')
    expect(JSON.stringify(result.error)).not.toContain('internal only')
  })

  it('reports the current state on a rejected transition', () => {
    const result = resultFromError(
      new ConflictError('This request was already approved.', 'approved'),
    )

    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.currentState).toBe('approved')
  })

  it('reports retry-after on rate limiting', () => {
    const result = resultFromError(new RateLimitError('Too many attempts.', 60))

    if (result.ok) return
    expect(result.error.retryAfterSeconds).toBe(60)
  })

  it('replaces non-user-facing messages with a generic one', () => {
    const result = resultFromError(
      new InfrastructureError('connect ECONNREFUSED 127.0.0.1:54322', { detail: 'db down' }),
      'corr-1',
    )

    if (result.ok) return
    expect(result.error.code).toBe('INFRASTRUCTURE_FAILURE')
    expect(result.error.message).not.toContain('ECONNREFUSED')
    // The correlation ID is what makes the generic message actionable.
    expect(result.error.correlationId).toBe('corr-1')
  })

  it('never leaks the message of an unknown throw', () => {
    const result = resultFromError(new TypeError('cannot read property id of undefined'), 'corr-2')

    if (result.ok) return
    expect(result.error.code).toBe('INFRASTRUCTURE_FAILURE')
    expect(result.error.message).not.toContain('cannot read property')
    expect(result.error.correlationId).toBe('corr-2')
  })

  it('does not attach a correlation ID to expected user-facing failures', () => {
    // A resident should not be shown a support reference for their own typo.
    const result = resultFromError(new NotFoundError('We could not find that request.'), 'corr-3')

    if (result.ok) return
    expect(result.error.correlationId).toBeUndefined()
  })

  it('hides idempotency and authorization detail from the client payload', () => {
    const idempotency = resultFromError(new IdempotencyConflictError('key reused with new payload'))
    const authorization = resultFromError(
      new AuthorizationError('You do not have permission to do that.', 'documents.approve'),
    )

    if (idempotency.ok || authorization.ok) return
    expect(idempotency.error.message).not.toContain('key reused')
    // The permission name is an internal identifier — it is audited, not shown.
    expect(JSON.stringify(authorization.error)).not.toContain('documents.approve')
  })
})

describe('toAppError', () => {
  it('preserves an AppError unchanged', () => {
    const original = new NotFoundError('gone')
    expect(toAppError(original)).toBe(original)
  })

  it('wraps anything else as an infrastructure failure and keeps the cause', () => {
    const cause = new Error('socket hang up')
    const wrapped = toAppError(cause, 'corr-9')

    expect(wrapped).toBeInstanceOf(InfrastructureError)
    expect(wrapped.isUserFacing).toBe(false)
    expect(wrapped.detail).toBe('socket hang up')
    expect(wrapped.correlationId).toBe('corr-9')
    expect(wrapped.cause).toBe(cause)
  })

  it('wraps non-Error throws', () => {
    const wrapped = toAppError('a string was thrown')
    expect(wrapped).toBeInstanceOf(InfrastructureError)
    expect(wrapped.detail).toBe('a string was thrown')
  })
})
