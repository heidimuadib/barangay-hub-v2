import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface TenantRow {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly is_active: boolean
  readonly created_at: string
}

/** Tenant METADATA only — platform authority never reaches tenant data. */
export async function fetchTenants(): Promise<readonly TenantRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('barangays')
    .select('id, code, name, is_active, created_at')
    .order('name', { ascending: true })
  if (error) {
    throw new Error(`tenants query failed: ${error.code}`)
  }
  return data
}

export interface PlatformAssignmentRow {
  readonly user_id: string
  readonly role_key: string
  readonly granted_at: string
}

export async function fetchPlatformAssignments(): Promise<readonly PlatformAssignmentRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('platform_role_assignments')
    .select('user_id, role_key, granted_at')
    .order('granted_at', { ascending: true })
  if (error) {
    throw new Error(`platform assignments query failed: ${error.code}`)
  }
  return data
}
