'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { fail, resultFromError, toAppError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { emailDigest, recordSessionlessSecurityEvent } from '@/services/audit/security-events'

import { signInSchema } from '../schemas/sign-in.schema'
import {
  appendCallerAuditEntry,
  getAuthorizationContext,
  landingRouteFor,
} from '../services/authorization'

/**
 * Uniform by design (Phase 5 §11.2): a wrong password, an unknown address and
 * a malformed address all produce this exact message. Anything more specific
 * is an account-enumeration oracle.
 */
const UNIFORM_FAILURE =
  'That email and password combination did not work. Check both and try again.'

export async function signInAction(
  _previous: Result<never> | null,
  formData: FormData,
): Promise<Result<never>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  // redirect() throws a framework control-flow error, so it must be called
  // OUTSIDE the try/catch that converts failures into Results.
  const outcome = await attemptSignIn(formData, correlationId)
  if (typeof outcome === 'string') {
    redirect(outcome)
  }
  return outcome
}

async function attemptSignIn(
  formData: FormData,
  correlationId: string | undefined,
): Promise<Result<never> | string> {
  try {
    const parsed = signInSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    })
    if (!parsed.success) {
      return fail({ code: 'AUTHENTICATION_REQUIRED', message: UNIFORM_FAILURE })
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error) {
      logger.warn('Sign-in failed', { status: error.status ?? null })
      await recordSessionlessSecurityEvent({
        action: 'auth.sign_in',
        targetType: 'session',
        metadata: { email_hash: emailDigest(parsed.data.email) },
        outcome: 'denied',
        ...(correlationId === undefined ? {} : { correlationId }),
      })
      return fail({ code: 'AUTHENTICATION_REQUIRED', message: UNIFORM_FAILURE })
    }

    const context = await getAuthorizationContext()
    if (!context) {
      // A session that immediately fails context resolution is treated as a
      // failed sign-in, not as a partially working one.
      await supabase.auth.signOut()
      return fail({ code: 'AUTHENTICATION_REQUIRED', message: UNIFORM_FAILURE })
    }

    logger.info('Sign-in succeeded', { userId: context.userId })
    try {
      await appendCallerAuditEntry({
        action: 'auth.sign_in',
        targetType: 'session',
        outcome: 'success',
        ...(correlationId === undefined ? {} : { correlationId }),
      })
    } catch (auditError) {
      logger.error('Audit write failed for successful sign-in', {
        userId: context.userId,
        cause: auditError instanceof Error ? auditError.message : String(auditError),
      })
    }

    return landingRouteFor(context)
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}
