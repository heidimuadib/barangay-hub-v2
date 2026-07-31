import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'

/**
 * Raw database access for the identity feature. Parsing and policy live in
 * the service layer — this module only moves data.
 */

/** Returns the verified auth user id, or null. getUser() revalidates the JWT. */
export async function fetchVerifiedUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Calls auth_context(); the payload is scoped to the caller by construction. */
export async function fetchAuthContextPayload(): Promise<Json> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('auth_context')
  if (error) {
    throw new Error(`auth_context failed: ${error.code}`)
  }
  return data
}

/**
 * Appends an audit entry on the CALLER's session (actor = auth.uid()).
 * Used for in-session security events such as authorization denials.
 */
export async function appendCallerAuditEntry(params: {
  action: string
  targetType: string
  targetId?: string
  barangayId?: string
  metadata?: Record<string, Json>
  outcome: 'success' | 'denied'
  correlationId?: string
}): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('append_audit_entry', {
    p_action: params.action,
    p_target_type: params.targetType,
    ...(params.targetId === undefined ? {} : { p_target_id: params.targetId }),
    ...(params.barangayId === undefined ? {} : { p_barangay_id: params.barangayId }),
    p_metadata: params.metadata ?? {},
    p_outcome: params.outcome,
    p_source: 'app',
    ...(params.correlationId === undefined ? {} : { p_correlation_id: params.correlationId }),
  })
  if (error) {
    throw new Error(`append_audit_entry failed: ${error.code}`)
  }
}

export async function updateOwnDisplayName(userId: string, displayName: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ display_name: displayName })
    .eq('user_id', userId)
    .select('user_id')
  if (error) {
    throw new Error(`profile update failed: ${error.code}`)
  }
  return (data ?? []).length === 1
}
