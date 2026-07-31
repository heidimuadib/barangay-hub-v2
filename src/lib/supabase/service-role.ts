import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { env } from '@/lib/config/env.server'
import { InfrastructureError } from '@/lib/errors'
import type { Database } from '@/types/database.types'

/**
 * The eight system operations permitted to bypass RLS.
 * Source of truth: Phase 4 §25.6. Adding a member requires an ADR and an update
 * to SERVICE_ROLE_ALLOWLIST in eslint.config.mjs.
 */
export const SERVICE_ROLE_REASONS = [
  'audit-append',
  'outbox-dispatch',
  'generation-worker',
  'certificate-artifact-write',
  'scheduled-job',
  'public-certificate-verification',
  'public-request-tracking',
  'tenant-provisioning',
  'support-grant-establishment',
] as const

export type ServiceRoleReason = (typeof SERVICE_ROLE_REASONS)[number]

/**
 * Supabase client that bypasses Row-Level Security.
 *
 * Every call must declare WHY. The reason is a typed union, so an undeclared use
 * is a compile error, and every real use is greppable. Tenant correctness is
 * still structural here because of the composite foreign-key topology
 * (Phase 4 DB-ADR-01) — this client can ignore RLS but it cannot create a
 * cross-tenant reference.
 *
 * Never import this from UI, route components, or feature code outside the
 * allow-list. The ESLint rule enforces that.
 */
export function createServiceRoleClient(reason: ServiceRoleReason) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new InfrastructureError('Service-role client requested but no key is configured.', {
      detail: `reason=${reason}; SUPABASE_SERVICE_ROLE_KEY is unset in APP_ENV=${env.APP_ENV}`,
    })
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-service-role-reason': reason },
    },
  })
}
