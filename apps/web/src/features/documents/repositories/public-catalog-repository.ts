import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import type { CatalogEntry } from '../types/documents'

/**
 * The PUBLIC catalog (Slice 3D, US-UI-006).
 *
 * Runs on the ordinary server client, which for an anonymous visitor carries
 * the `anon` role — deliberately not a service-role client, so what this
 * module can read is exactly what migration 20260808020000 granted `anon` and
 * nothing more. If that grant were ever removed, these queries would return
 * nothing rather than silently keep working through elevated credentials.
 *
 * A signed-in visitor hits the same code with their own role, and the
 * authenticated policies simply admit at least as much. There is no second
 * code path and no branch on "is someone logged in".
 */

export interface PublicBarangay {
  readonly id: string
  readonly name: string
  readonly code: string
}

export async function listPublicBarangays(): Promise<readonly PublicBarangay[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_public_barangays')
  if (error) {
    throw new Error(`public barangay directory query failed: ${error.code}`)
  }
  return data ?? []
}

/**
 * One barangay's publicly visible catalog.
 *
 * The policy already restricts this to active types in active barangays; the
 * explicit filters are correctness and index use, not the security boundary.
 */
export async function listPublicCatalog(barangayId: string): Promise<readonly CatalogEntry[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('document_types')
    .select(
      `id, code, name, description, fee_amount, fee_currency, sla_days, validity_days,
       values_are_placeholder, requires_supporting_evidence,
       document_type_requirements(id)`,
    )
    .eq('barangay_id', barangayId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`public catalog query failed: ${error.code}`)
  }

  return (data ?? []).map((row) => ({
    documentTypeId: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    terms: {
      feeAmount: row.fee_amount,
      feeCurrency: row.fee_currency,
      slaDays: row.sla_days,
      validityDays: row.validity_days,
      valuesArePlaceholder: row.values_are_placeholder,
    },
    requiresSupportingEvidence: row.requires_supporting_evidence,
    requirementCount: Array.isArray(row.document_type_requirements)
      ? row.document_type_requirements.length
      : 0,
  }))
}
