import { describe, expect, it } from 'vitest'

import {
  extendRequestContext,
  getCorrelationId,
  getRequestContext,
  newCorrelationId,
  withRequestContext,
} from './correlation'

describe('correlation context', () => {
  it('generates distinct identifiers', () => {
    expect(newCorrelationId()).not.toBe(newCorrelationId())
  })

  it('is undefined outside a request', () => {
    expect(getCorrelationId()).toBeUndefined()
  })

  it('propagates through synchronous and asynchronous call stacks', async () => {
    const correlationId = 'corr-fixed'

    await withRequestContext({ correlationId, route: '/api/health' }, async () => {
      expect(getCorrelationId()).toBe(correlationId)
      await Promise.resolve()
      // The point of AsyncLocalStorage: it survives the await boundary, which is
      // what lets a deeply nested service log with the caller's correlation ID.
      expect(getCorrelationId()).toBe(correlationId)
      expect(getRequestContext()?.route).toBe('/api/health')
    })

    expect(getCorrelationId()).toBeUndefined()
  })

  it('adds fields without losing the original correlation ID', () => {
    withRequestContext({ correlationId: 'corr-1' }, () => {
      extendRequestContext({ actorId: 'user-1', tenantCode: 'BGY-001' }, () => {
        expect(getCorrelationId()).toBe('corr-1')
        expect(getRequestContext()?.actorId).toBe('user-1')
        expect(getRequestContext()?.tenantCode).toBe('BGY-001')
      })

      // The extension is scoped — it does not leak back to the outer context.
      expect(getRequestContext()?.actorId).toBeUndefined()
    })
  })

  it('creates a correlation ID when extended outside a request', () => {
    extendRequestContext({ actorId: 'job-runner' }, () => {
      expect(getCorrelationId()).toBeTypeOf('string')
    })
  })
})
