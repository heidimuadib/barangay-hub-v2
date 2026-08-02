import 'server-only'

import { createHash } from 'node:crypto'

import { logger } from '@/lib/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Json } from '@barangay-hub/supabase/types'

/**
 * Audit writer for security events that occur WITHOUT a usable session —
 * primarily failed sign-ins, where no auth.uid() exists and the anon role
 * cannot execute append_audit_entry. This is the 'audit-append' service-role
 * operation (Phase 4 §25.6).
 *
 * In-session events (authorization denials, admin actions) do NOT come
 * through here: they are written on the caller's own session so the actor is
 * recorded by the database, not asserted by the application.
 */
export async function recordSessionlessSecurityEvent(params: {
  action: string
  targetType: string
  metadata?: Record<string, Json>
  outcome: 'success' | 'denied'
  correlationId?: string
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient('audit-append')
    const { error } = await supabase.rpc('append_audit_entry', {
      p_action: params.action,
      p_target_type: params.targetType,
      p_metadata: params.metadata ?? {},
      p_outcome: params.outcome,
      p_source: 'app',
      ...(params.correlationId === undefined ? {} : { p_correlation_id: params.correlationId }),
    })
    if (error) {
      throw new Error(`append_audit_entry failed: ${error.code}`)
    }
  } catch (error) {
    // Never let an audit failure break the security path it records — but it
    // must be loudly visible in the logs.
    logger.error('Audit write failed for a sessionless security event', {
      action: params.action,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * A stable digest that lets failed attempts against one account be
 * correlated without ever storing the address itself (Phase 6 §37.2).
 */
export function emailDigest(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}
