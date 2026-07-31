import 'server-only'

import {
  assertNoPublicSecrets,
  formatEnvIssues,
  serverEnvSchema,
  type ServerEnv,
} from './env.schema'

/**
 * Server environment, validated once at module load.
 *
 * Phase 6 §17 / §19.3 — misconfiguration must fail at boot, never at runtime.
 * Importing this module from a Client Component is a build error (`server-only`).
 */
function loadServerEnv(): ServerEnv {
  const offenders = assertNoPublicSecrets(process.env)
  if (offenders.length > 0) {
    throw new Error(
      [
        'Refusing to start: secret-like variables are exposed to the browser.',
        `The NEXT_PUBLIC_ prefix inlines values into the client bundle.`,
        `Offending variable names: ${offenders.join(', ')}`,
        'Rename them without the NEXT_PUBLIC_ prefix.',
      ].join('\n'),
    )
  }

  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      [
        'Invalid server environment configuration.',
        formatEnvIssues(parsed.error),
        '',
        'Copy .env.example to .env.local and fill in the required values.',
        'Values are never printed here by design.',
      ].join('\n'),
    )
  }

  return parsed.data
}

export const env: ServerEnv = loadServerEnv()

export const isProduction = env.APP_ENV === 'production'
export const isHosted = env.APP_ENV === 'integration' || env.APP_ENV === 'production'
export const isLocal = env.APP_ENV === 'local' || env.APP_ENV === 'test'
