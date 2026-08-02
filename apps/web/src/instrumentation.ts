/**
 * Boot hook.
 *
 * Validating the environment here means a misconfigured deployment fails at
 * startup with a named reason, rather than at the first request with a stack
 * trace (Phase 6 §17, §19.3).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { env } = await import('@/lib/config/env.server')
  const { logger } = await import('@/lib/logger')

  logger.info('Application starting', {
    appEnv: env.APP_ENV,
    logLevel: env.LOG_LEVEL,
    emailProvider: env.EMAIL_PROVIDER,
    supabaseHost: new URL(env.NEXT_PUBLIC_SUPABASE_URL).host,
    flags: {
      assistance: env.FLAG_ASSISTANCE_MODULE,
      households: env.FLAG_HOUSEHOLDS_MODULE,
      feedback: env.FLAG_FEEDBACK_MODULE,
      sms: env.FLAG_SMS_CHANNEL,
      esignature: env.FLAG_ESIGNATURE,
    },
  })

  if (env.APP_ENV !== 'production') {
    logger.warn(
      'Running in a NON-PRODUCTION environment. Real resident data and government ID files are prohibited (DEC-ENV-04).',
      { appEnv: env.APP_ENV },
    )
  }
}
