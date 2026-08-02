import { z } from 'zod'

/**
 * Environment identifiers.
 *
 * `integration` is the hosted, NON-PRODUCTION Supabase environment
 * (`weadxbwtupvjqaqploij`). Its final role as staging or production is an open
 * decision — DEC-ENV-01 (Phase 6 Supabase Environment Correction §1.3).
 */
export const APP_ENVS = ['local', 'test', 'preview', 'integration', 'production'] as const
export type AppEnv = (typeof APP_ENVS)[number]

/**
 * Booleans must be parsed from an explicit string enum.
 * `z.coerce.boolean()` treats the string "false" as `true`, which would silently
 * enable every feature flag.
 */
const envBoolean = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true')

/** Variables that are safe to ship to the browser. */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(APP_ENVS),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'Anon key looks truncated'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

/** Server-only variables. Never exposed to the browser. */
export const serverEnvSchema = clientEnvSchema
  .extend({
    APP_ENV: z.enum(APP_ENVS),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    SUPABASE_PROJECT_REF: z
      .string()
      .regex(/^[a-z]{20}$/, 'Supabase project ref is 20 lowercase letters')
      .optional(),
    SUPABASE_DB_PASSWORD: z.string().optional(),

    EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    EMAIL_ALLOWLIST: z.string().optional(),

    CRON_SECRET: z.string().min(16).optional(),
    SENTRY_DSN: z.string().optional(),

    FLAG_ASSISTANCE_MODULE: envBoolean('false'),
    FLAG_HOUSEHOLDS_MODULE: envBoolean('false'),
    FLAG_FEEDBACK_MODULE: envBoolean('false'),
    FLAG_SMS_CHANNEL: envBoolean('false'),
    FLAG_ESIGNATURE: envBoolean('false'),
  })
  .superRefine((env, ctx) => {
    // A mismatch here means the browser would display the wrong environment.
    if (env.APP_ENV !== env.NEXT_PUBLIC_APP_ENV) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXT_PUBLIC_APP_ENV'],
        message: `NEXT_PUBLIC_APP_ENV (${env.NEXT_PUBLIC_APP_ENV}) must match APP_ENV (${env.APP_ENV}).`,
      })
    }

    if (env.APP_ENV === 'production') {
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message: 'Required in production (audit, outbox and job workers depend on it).',
        })
      }
      if (!env.CRON_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CRON_SECRET'],
          message: 'Required in production — cron endpoints must be authenticated.',
        })
      }
      if (env.EMAIL_PROVIDER !== 'resend') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_PROVIDER'],
          message: 'Production must use a real email provider.',
        })
      }
      if (env.EMAIL_ALLOWLIST && env.EMAIL_ALLOWLIST.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_ALLOWLIST'],
          message:
            'EMAIL_ALLOWLIST is a non-production safety net and must be empty in production.',
        })
      }
    }

    // Phase 6 §19.2 rule 2 — no real email delivery outside production/integration.
    if (env.EMAIL_PROVIDER === 'resend') {
      if (!env.RESEND_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message: 'Required when EMAIL_PROVIDER=resend.',
        })
      }
      if (!env.EMAIL_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message: 'Required when EMAIL_PROVIDER=resend.',
        })
      }
      if (env.APP_ENV === 'local' || env.APP_ENV === 'test' || env.APP_ENV === 'preview') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_PROVIDER'],
          message: `Real email delivery is forbidden in ${env.APP_ENV} (Phase 6 §19.2). Use EMAIL_PROVIDER=console.`,
        })
      }
    }
  })

export type ServerEnv = z.infer<typeof serverEnvSchema>

/**
 * Key names that must never carry the NEXT_PUBLIC_ prefix, because that prefix
 * inlines the value into the browser bundle.
 *
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` is deliberately exempt — the anon key is public
 * by design and is protected by RLS.
 */
const PUBLIC_PREFIX = 'NEXT_PUBLIC_'
const FORBIDDEN_PUBLIC_FRAGMENTS = [
  'SERVICE_ROLE',
  'SECRET',
  'PASSWORD',
  'PRIVATE',
  'CREDENTIAL',
  'ACCESS_TOKEN',
  'REFRESH_TOKEN',
]
const PUBLIC_EXEMPTIONS = new Set(['NEXT_PUBLIC_SUPABASE_ANON_KEY'])

/**
 * Third layer of the "no secret in the browser bundle" control.
 * Layer 1 is the ESLint rule, layer 2 is the built-output scan
 * (`pnpm check:bundle-secrets`), and this is the runtime assertion.
 */
export function assertNoPublicSecrets(source: Record<string, string | undefined>): string[] {
  const offenders: string[] = []
  for (const key of Object.keys(source)) {
    if (!key.startsWith(PUBLIC_PREFIX)) continue
    if (PUBLIC_EXEMPTIONS.has(key)) continue
    const upper = key.toUpperCase()
    if (FORBIDDEN_PUBLIC_FRAGMENTS.some((fragment) => upper.includes(fragment))) {
      offenders.push(key)
    }
  }
  return offenders
}

/** Formats Zod issues without ever printing a value. */
export function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
}
