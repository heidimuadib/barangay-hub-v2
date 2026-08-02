import { describe, expect, it } from 'vitest'

import { REDACTED, redact } from './redact'

describe('redact', () => {
  it('removes secret values but keeps the field name', () => {
    const output = redact({
      SUPABASE_SERVICE_ROLE_KEY: 'whatever-this-is',
      password: 'hunter2',
      apiKey: 'abc',
      authorization: 'Bearer abc',
      requestId: 'req_123',
    }) as Record<string, unknown>

    expect(output['SUPABASE_SERVICE_ROLE_KEY']).toBe(REDACTED)
    expect(output['password']).toBe(REDACTED)
    expect(output['apiKey']).toBe(REDACTED)
    expect(output['authorization']).toBe(REDACTED)
    // Non-sensitive fields survive — a redactor that eats everything is useless.
    expect(output['requestId']).toBe('req_123')
  })

  it('removes resident personal data', () => {
    const output = redact({
      fullName: 'Juan dela Cruz',
      birthDate: '1990-01-01',
      address: '123 Mabini St',
      email: 'juan@example.com',
      phone: '+639171234567',
      narrative: 'complaint text',
      residentId: '9f1c3a2e',
    }) as Record<string, unknown>

    expect(output['fullName']).toBe(REDACTED)
    expect(output['birthDate']).toBe(REDACTED)
    expect(output['address']).toBe(REDACTED)
    expect(output['email']).toBe(REDACTED)
    expect(output['phone']).toBe(REDACTED)
    expect(output['narrative']).toBe(REDACTED)
    // An opaque identifier is not personal data and is needed for support.
    expect(output['residentId']).toBe('9f1c3a2e')
  })

  it('masks personal values that appear inside an innocuously named field', () => {
    const output = redact({
      detail: 'failed for juan@example.com from +639171234567',
    }) as Record<string, unknown>

    expect(output['detail']).toBe(`failed for ${REDACTED} from ${REDACTED}`)
  })

  it('masks JWT-shaped strings wherever they appear', () => {
    // Segment lengths match a real token; the pattern requires 8+ characters per
    // segment so that ordinary words are never mistaken for a credential.
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpM'
    const output = redact({ message: `token was ${jwt}` }) as Record<string, unknown>

    expect(output['message']).toBe(`token was ${REDACTED}`)
    expect(JSON.stringify(output)).not.toContain('eyJ')
  })

  it('redacts nested structures', () => {
    const output = redact({
      request: { actor: { email: 'a@b.com' }, meta: { correlationId: 'c-1' } },
    }) as Record<string, Record<string, Record<string, unknown>>>

    expect(output['request']?.['actor']?.['email']).toBe(REDACTED)
    expect(output['request']?.['meta']?.['correlationId']).toBe('c-1')
  })

  it('contains circular references instead of throwing', () => {
    const node: Record<string, unknown> = { name: 'root' }
    node['self'] = node

    expect(() => redact(node)).not.toThrow()
    expect((redact(node) as Record<string, unknown>)['self']).toBe('[circular]')
  })

  it('caps depth, array length and string length', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'too deep' } } } } } } }
    expect(JSON.stringify(redact(deep))).toContain('[max-depth]')

    const long = Array.from({ length: 60 }, (_, index) => index)
    const redactedArray = redact(long) as unknown[]
    expect(redactedArray).toHaveLength(51)
    expect(redactedArray[50]).toBe('[+10 more]')

    const huge = redact({ detail: 'x'.repeat(3000) }) as Record<string, string>
    expect(huge['detail']).toContain('[truncated]')
  })

  it('serialises Errors without leaking a personal value in the message', () => {
    const output = redact(new Error('lookup failed for juan@example.com')) as Record<
      string,
      unknown
    >

    expect(output['name']).toBe('Error')
    expect(output['message']).toBe(`lookup failed for ${REDACTED}`)
  })
})
