import { clientEnvSchema, formatEnvIssues, type ClientEnv } from './env.schema'

/**
 * Client environment.
 *
 * Each variable is referenced as a full literal so that Next.js can inline it at
 * build time. Do not refactor this into a loop or a dynamic lookup — the values
 * would become `undefined` in the browser.
 */
function loadClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  })

  if (!parsed.success) {
    throw new Error(
      ['Invalid public environment configuration.', formatEnvIssues(parsed.error)].join('\n'),
    )
  }

  return parsed.data
}

export const clientEnv: ClientEnv = loadClientEnv()
