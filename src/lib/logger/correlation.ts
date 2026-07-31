import { AsyncLocalStorage } from 'node:async_hooks'

export const CORRELATION_HEADER = 'x-correlation-id'

export interface RequestContext {
  readonly correlationId: string
  readonly route?: string
  readonly actorId?: string
  readonly tenantCode?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

/** Generates a correlation ID. Uses Web Crypto, available in Node and Edge. */
export function newCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * Runs `fn` with a request context attached.
 * Anything logged inside — including deep inside a domain service — carries the
 * same correlation ID, which is what makes a user-visible error reference
 * resolvable to a server log entry (Phase 6 §37.1).
 */
export function withRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn)
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId
}

/** Adds fields to the current context for the remainder of the request. */
export function extendRequestContext<T>(patch: Partial<RequestContext>, fn: () => T): T {
  const current = storage.getStore()
  const next: RequestContext = {
    correlationId: current?.correlationId ?? newCorrelationId(),
    ...current,
    ...patch,
  }
  return storage.run(next, fn)
}
