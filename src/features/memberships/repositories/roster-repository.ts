import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Roster reads and membership mutations. Every query is ALSO constrained by
 * RLS — the explicit barangay_id filters here are correctness and index use,
 * not the security boundary.
 */

export interface RosterRow {
  readonly id: string
  readonly user_id: string
  readonly status: 'invited' | 'active' | 'disabled'
  readonly user_profiles: { display_name: string } | null
  readonly membership_roles: readonly { role_key: string }[]
}

export async function fetchRoster(barangayId: string): Promise<readonly RosterRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, status, user_profiles(display_name), membership_roles(role_key)')
    .eq('barangay_id', barangayId)
    .order('created_at', { ascending: true })
  if (error) {
    throw new Error(`roster query failed: ${error.code}`)
  }
  return data
}

export async function fetchBarangayRoles(): Promise<readonly { key: string; name: string }[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('roles')
    .select('key, name')
    .eq('scope', 'barangay')
    .order('key', { ascending: true })
  if (error) {
    throw new Error(`roles query failed: ${error.code}`)
  }
  return data
}

/** Returns true when exactly one row changed; false when RLS hid the target. */
export async function updateMembershipStatus(params: {
  barangayId: string
  membershipId: string
  status: 'invited' | 'active' | 'disabled'
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('memberships')
    .update({ status: params.status })
    .eq('id', params.membershipId)
    .eq('barangay_id', params.barangayId)
    .select('id')
  if (error) {
    throw new Error(`membership status update failed: ${error.code}`)
  }
  return (data ?? []).length === 1
}

export type RoleMutationOutcome = 'done' | 'duplicate' | 'not-found' | 'denied'

export async function insertMembershipRole(params: {
  barangayId: string
  membershipId: string
  roleKey: string
}): Promise<RoleMutationOutcome> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('membership_roles').insert({
    membership_id: params.membershipId,
    barangay_id: params.barangayId,
    role_key: params.roleKey,
  })
  if (!error) return 'done'
  if (error.code === '23505') return 'duplicate'
  // FK violation: the membership does not exist in THIS barangay — a forged
  // or cross-tenant target, indistinguishable from "not found" (Phase 4 §13.6).
  if (error.code === '23503') return 'not-found'
  if (error.code === '42501') return 'denied'
  throw new Error(`role insert failed: ${error.code}`)
}

export async function deleteMembershipRole(params: {
  barangayId: string
  membershipId: string
  roleKey: string
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('membership_roles')
    .delete()
    .eq('membership_id', params.membershipId)
    .eq('barangay_id', params.barangayId)
    .eq('role_key', params.roleKey)
    .select('role_key')
  if (error) {
    throw new Error(`role delete failed: ${error.code}`)
  }
  return (data ?? []).length === 1
}

export type InviteOutcome =
  | { readonly kind: 'created'; readonly membershipId: string }
  | { readonly kind: 'not-eligible' }
  | { readonly kind: 'denied' }

export async function inviteByEmail(params: {
  barangayId: string
  email: string
  correlationId?: string
}): Promise<InviteOutcome> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('create_membership_by_email', {
    p_barangay_id: params.barangayId,
    p_email: params.email,
    ...(params.correlationId === undefined ? {} : { p_correlation_id: params.correlationId }),
  })
  if (!error) return { kind: 'created', membershipId: data }
  if (error.message.includes('INVITE_NOT_ELIGIBLE')) return { kind: 'not-eligible' }
  if (error.code === '42501' || error.message.includes('AUTHORIZATION_DENIED')) {
    return { kind: 'denied' }
  }
  throw new Error(`invite failed: ${error.code}`)
}
