import { describe, expect, it } from 'vitest'

import { mapRegistryError } from '@/features/registry/repositories/registry-repository'
import { throwRegistryFailure, unwrap } from '@/features/registry/services/registry-service'
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  isAppError,
} from '@/lib/errors'

describe('mapRegistryError', () => {
  it('maps every domain error identifier to a typed failure', () => {
    expect(mapRegistryError('AUTHORIZATION_DENIED')).toBe('denied')
    expect(mapRegistryError('AUTHENTICATION_REQUIRED')).toBe('denied')
    expect(mapRegistryError('ILLEGAL_TRANSITION')).toBe('illegal-transition')
    expect(mapRegistryError('REASON_REQUIRED')).toBe('reason-required')
    expect(mapRegistryError('NOTE_REQUIRED')).toBe('reason-required')
    expect(mapRegistryError('EVIDENCE_INCOMPLETE')).toBe('evidence-incomplete')
    expect(mapRegistryError('APPLICATION_ALREADY_OPEN')).toBe('already-open')
    expect(mapRegistryError('PERSON_SUPERSEDED')).toBe('person-superseded')
    expect(mapRegistryError('SUPERSEDE_BLOCKED_BY_TWO_ACCOUNTS')).toBe(
      'supersede-blocked-two-accounts',
    )
    expect(mapRegistryError('MEMBERSHIP_DISABLED')).toBe('membership-disabled')
  })

  it('returns null for unknown messages so infrastructure failures stay loud', () => {
    expect(mapRegistryError('connection refused')).toBeNull()
  })

  it('keeps not-found and not-eligible indistinguishable (anti-enumeration)', () => {
    // LINK_NOT_ELIGIBLE (no such user / already linked), SUPERSEDE_NOT_ELIGIBLE
    // (wrong tenant / already superseded) and LINK_NOT_FOUND all collapse to
    // one failure, mirroring the database's uniform errors.
    expect(mapRegistryError('LINK_NOT_ELIGIBLE')).toBe('not-eligible')
    expect(mapRegistryError('LINK_NOT_FOUND')).toBe('not-eligible')
    expect(mapRegistryError('SUPERSEDE_NOT_ELIGIBLE')).toBe('not-eligible')
    expect(mapRegistryError('BARANGAY_NOT_AVAILABLE')).toBe('not-eligible')
  })
})

describe('throwRegistryFailure', () => {
  it('throws the approved error class per failure', () => {
    expect(() => throwRegistryFailure('denied')).toThrow(AuthorizationError)
    expect(() => throwRegistryFailure('not-eligible')).toThrow(NotFoundError)
    expect(() => throwRegistryFailure('illegal-transition')).toThrow(ConflictError)
    expect(() => throwRegistryFailure('already-open')).toThrow(ConflictError)
    expect(() => throwRegistryFailure('reason-required')).toThrow(BusinessRuleError)
    expect(() => throwRegistryFailure('evidence-incomplete')).toThrow(BusinessRuleError)
    expect(() => throwRegistryFailure('supersede-blocked-two-accounts')).toThrow(BusinessRuleError)
    expect(() => throwRegistryFailure('membership-disabled')).toThrow(BusinessRuleError)
  })

  it('produces user-facing messages that never leak internals', () => {
    for (const failure of [
      'denied',
      'not-eligible',
      'illegal-transition',
      'reason-required',
    ] as const) {
      try {
        throwRegistryFailure(failure)
      } catch (error) {
        expect(isAppError(error)).toBe(true)
        if (isAppError(error)) {
          expect(error.isUserFacing).toBe(true)
          expect(error.message).not.toMatch(/sql|postgres|rpc|42501|P0001/i)
        }
      }
    }
  })
})

describe('unwrap', () => {
  it('returns data on success and throws the mapped error on failure', () => {
    expect(unwrap({ ok: true, data: 42 }, 'test-op')).toBe(42)
    expect(() => unwrap({ ok: false, failure: 'denied' }, 'test-op')).toThrow(AuthorizationError)
  })
})
