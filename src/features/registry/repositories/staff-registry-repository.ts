import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Staff registry reads. Every query is additionally constrained by RLS
 * (`registry.read`); the explicit `barangay_id` filters are correctness and
 * index use, not the security boundary.
 */

export interface RegistryListRow {
  readonly id: string
  readonly first_name: string
  readonly middle_name: string | null
  readonly last_name: string
  readonly suffix: string | null
  readonly birthdate: string | null
  readonly residency_basis_key: string
  readonly source_channel: string
  readonly superseded_by: string | null
  readonly created_at: string
  readonly person_accounts: { user_id: string }[]
  readonly verification_applications: { state: string; created_at: string }[]
}

const LIST_COLUMNS =
  'id, first_name, middle_name, last_name, suffix, birthdate, residency_basis_key, source_channel, superseded_by, created_at, person_accounts(user_id), verification_applications(state, created_at)'

export interface RegistryPage {
  readonly rows: readonly RegistryListRow[]
  readonly total: number
}

export async function fetchRegistryPage(params: {
  barangayId: string
  limit: number
  offset: number
}): Promise<RegistryPage> {
  const supabase = await createServerSupabaseClient()
  const { data, error, count } = await supabase
    .from('persons')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('barangay_id', params.barangayId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .range(params.offset, params.offset + params.limit - 1)

  if (error) {
    throw new Error(`registry list query failed: ${error.code}`)
  }
  return { rows: data, total: count ?? 0 }
}

export async function fetchPersonDetail(
  barangayId: string,
  personId: string,
): Promise<RegistryListRow | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('persons')
    .select(LIST_COLUMNS)
    .eq('barangay_id', barangayId)
    .eq('id', personId)
    .maybeSingle()

  if (error) {
    throw new Error(`person detail query failed: ${error.code}`)
  }
  return data
}
