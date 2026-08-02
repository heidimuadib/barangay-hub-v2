import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface AuditQueryRow {
  readonly id: number
  readonly occurred_at: string
  readonly actor_user_id: string | null
  readonly action: string
  readonly target_type: string
  readonly target_id: string | null
  readonly outcome: string
  readonly source: string
  readonly metadata: unknown
}

const AUDIT_COLUMNS =
  'id, occurred_at, actor_user_id, action, target_type, target_id, outcome, source, metadata'

/** Latest tenant events. RLS admits only audit.read holders of this tenant. */
export async function fetchTenantAuditEvents(
  barangayId: string,
  limit: number,
): Promise<readonly AuditQueryRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('audit_events')
    .select(AUDIT_COLUMNS)
    .eq('barangay_id', barangayId)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) {
    throw new Error(`audit query failed: ${error.code}`)
  }
  return data
}

/** Latest platform-scope events (barangay_id is null). */
export async function fetchPlatformAuditEvents(limit: number): Promise<readonly AuditQueryRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('audit_events')
    .select(AUDIT_COLUMNS)
    .is('barangay_id', null)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) {
    throw new Error(`platform audit query failed: ${error.code}`)
  }
  return data
}
