'use server'

import { headers } from 'next/headers'

import { clientEnv } from '@/lib/config/env.client'
import { fail, ok, resultFromError, toAppError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'
import { createInMemoryRateLimiter } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { emailDigest, recordSessionlessSecurityEvent } from '@/services/audit/security-events'

import { signUpSchema } from '../schemas/sign-up.schema'

/**
 * Public resident sign-up (ADR-0006 Option C, point 1).
 *
 * ANTI-ENUMERATION IS THE WHOLE DESIGN HERE. Every outcome — new address,
 * address that already has an account, malformed input, rate-limited caller —
 * returns the SAME neutral confirmation. Supabase itself is careful (with
 * confirmations enabled it returns a user with an empty `identities` array
 * rather than an error for an existing address), and this action never
 * inspects that difference for the caller's benefit.
 *
 * The account proves nothing (point 3): it carries no privileged metadata, no
 * membership and no person record. Verification is what confers standing, and
 * only staff approval grants it (point 4).
 */

/**
 * Module-scoped so the window survives between requests in one process.
 * Per-instance only — see the seam note in @/lib/rate-limit. Two limiters:
 * one per client address (blunt flood control), one per address digest (slows
 * a targeted attempt even when it rotates source addresses).
 */
const perClient = createInMemoryRateLimiter({ limit: 10, windowSeconds: 15 * 60 })
const perEmail = createInMemoryRateLimiter({ limit: 3, windowSeconds: 60 * 60 })

function clientKey(headerList: Headers): string {
  // Never an identifier we could tie back to a person: the first forwarded
  // hop, or a constant when the header is absent (local development).
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded && forwarded.length > 0 ? forwarded : 'local'
}

export async function signUpAction(
  _previous: Result<{ pending: true }> | null,
  formData: FormData,
): Promise<Result<{ pending: true }>> {
  const headerList = await headers()
  const correlationId = headerList.get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = signUpSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    })

    if (!parsed.success) {
      // Field-level feedback is safe here: it describes the SUBMITTED value
      // (too short, mismatched), never whether the address exists.
      const issue = parsed.error.issues[0]
      return fail({
        code: 'VALIDATION_FAILED',
        message: 'Check the form and try again.',
        fieldErrors: {
          [String(issue?.path[0] ?? 'email')]: [issue?.message ?? 'Invalid value.'],
        },
      })
    }

    const digest = emailDigest(parsed.data.email)

    // Rate-limit BEFORE touching Auth, and return the uniform acceptance
    // rather than a 429 — a distinguishable throttle response is itself an
    // oracle ("this address is being probed").
    const byClient = perClient.check(clientKey(headerList))
    const byEmail = perEmail.check(digest)
    if (!byClient.allowed || !byEmail.allowed) {
      logger.warn('Sign-up rate limited', {
        scope: byClient.allowed ? 'email' : 'client',
        retryAfterSeconds: Math.max(byClient.retryAfterSeconds, byEmail.retryAfterSeconds),
      })
      await recordSessionlessSecurityEvent({
        action: 'auth.sign_up',
        targetType: 'account',
        metadata: { email_hash: digest, outcome_detail: 'rate_limited' },
        outcome: 'denied',
        ...(correlationId === undefined ? {} : { correlationId }),
      })
      return ok({ pending: true })
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
        // No `data` payload by design: user metadata is writable by the
        // account holder, so nothing that authorization reads may live there
        // (README non-negotiable; ADR-0006 point 3).
      },
    })

    if (error) {
      logger.warn('Sign-up refused by auth provider', { status: error.status ?? null })
      await recordSessionlessSecurityEvent({
        action: 'auth.sign_up',
        targetType: 'account',
        metadata: { email_hash: digest, outcome_detail: 'provider_refused' },
        outcome: 'denied',
        ...(correlationId === undefined ? {} : { correlationId }),
      })
      // Still uniform: a provider error must not distinguish this address.
      return ok({ pending: true })
    }

    // `identities: []` means the address already had an account. It is logged
    // as a distinct AUDIT fact (staff investigating abuse need it) and is
    // never reflected back to the caller.
    const alreadyRegistered = (data.user?.identities?.length ?? 0) === 0
    await recordSessionlessSecurityEvent({
      action: 'auth.sign_up',
      targetType: 'account',
      metadata: {
        email_hash: digest,
        outcome_detail: alreadyRegistered ? 'existing_address' : 'created',
      },
      outcome: 'success',
      ...(correlationId === undefined ? {} : { correlationId }),
    })
    logger.info('Sign-up accepted', { alreadyRegistered })

    return ok({ pending: true })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}
// NOTE: a 'use server' module may export async functions ONLY — the uniform
// acceptance copy therefore lives in the form component, not here.
