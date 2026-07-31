import { describe, expect, it } from 'vitest'

import {
  assertNoPublicSecrets,
  clientEnvSchema,
  formatEnvIssues,
  serverEnvSchema,
} from './env.schema'

const baseEnv = {
  APP_ENV: 'local',
  NEXT_PUBLIC_APP_ENV: 'local',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'not-a-real-key-0000000000000000000000',
}

describe('serverEnvSchema', () => {
  it('accepts a valid local configuration', () => {
    const parsed = serverEnvSchema.safeParse(baseEnv)
    expect(parsed.success).toBe(true)
  })

  it('parses the string "false" as false', () => {
    // z.coerce.boolean() would return true here and silently enable every flag.
    const parsed = serverEnvSchema.safeParse({ ...baseEnv, FLAG_SMS_CHANNEL: 'false' })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.FLAG_SMS_CHANNEL).toBe(false)
  })

  it('parses the string "true" as true', () => {
    const parsed = serverEnvSchema.safeParse({ ...baseEnv, FLAG_SMS_CHANNEL: 'true' })
    if (!parsed.success) return
    expect(parsed.data.FLAG_SMS_CHANNEL).toBe(true)
  })

  it('rejects a mismatch between APP_ENV and NEXT_PUBLIC_APP_ENV', () => {
    const parsed = serverEnvSchema.safeParse({ ...baseEnv, NEXT_PUBLIC_APP_ENV: 'production' })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(formatEnvIssues(parsed.error)).toContain('NEXT_PUBLIC_APP_ENV')
  })

  it('forbids real email delivery outside production', () => {
    const parsed = serverEnvSchema.safeParse({
      ...baseEnv,
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'placeholder',
      EMAIL_FROM: 'noreply@example.test',
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(formatEnvIssues(parsed.error)).toContain('EMAIL_PROVIDER')
  })

  it('requires the service-role key, cron secret and a real mailer in production', () => {
    const parsed = serverEnvSchema.safeParse({
      ...baseEnv,
      APP_ENV: 'production',
      NEXT_PUBLIC_APP_ENV: 'production',
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    const message = formatEnvIssues(parsed.error)
    expect(message).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(message).toContain('CRON_SECRET')
    expect(message).toContain('EMAIL_PROVIDER')
  })

  it('requires the production email allow-list to be empty', () => {
    const parsed = serverEnvSchema.safeParse({
      ...baseEnv,
      APP_ENV: 'production',
      NEXT_PUBLIC_APP_ENV: 'production',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder-value-000000000000',
      CRON_SECRET: 'placeholder-cron-secret',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'placeholder',
      EMAIL_FROM: 'noreply@example.test',
      EMAIL_ALLOWLIST: 'someone@example.test',
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(formatEnvIssues(parsed.error)).toContain('EMAIL_ALLOWLIST')
  })

  it('never includes a value in the formatted issue output', () => {
    const parsed = serverEnvSchema.safeParse({
      ...baseEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'super-secret-not-a-url',
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(formatEnvIssues(parsed.error)).not.toContain('super-secret-not-a-url')
  })
})

describe('clientEnvSchema', () => {
  it('rejects a truncated anon key', () => {
    const parsed = clientEnvSchema.safeParse({ ...baseEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'short' })
    expect(parsed.success).toBe(false)
  })
})

describe('assertNoPublicSecrets', () => {
  it('flags secret-like names carrying the NEXT_PUBLIC_ prefix', () => {
    const offenders = assertNoPublicSecrets({
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'x',
      NEXT_PUBLIC_CRON_SECRET: 'x',
      NEXT_PUBLIC_DB_PASSWORD: 'x',
      NEXT_PUBLIC_ACCESS_TOKEN: 'x',
    })

    expect(offenders).toHaveLength(4)
  })

  it('exempts the anon key, which is public by design', () => {
    expect(assertNoPublicSecrets({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x' })).toEqual([])
  })

  it('ignores correctly named server-only variables', () => {
    expect(assertNoPublicSecrets({ SUPABASE_SERVICE_ROLE_KEY: 'x', CRON_SECRET: 'x' })).toEqual([])
  })
})
