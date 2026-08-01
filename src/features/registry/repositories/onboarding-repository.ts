import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Reads for the resident's own onboarding and verification status. Every
 * query is scoped by RLS to the caller's own person and application — there
 * is no tenant-wide read here.
 */

export interface BarangayDirectoryEntry {
  readonly id: string
  readonly name: string
  readonly code: string
}

export async function listActiveBarangays(): Promise<readonly BarangayDirectoryEntry[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_active_barangays')
  if (error) {
    throw new Error(`barangay directory query failed: ${error.code}`)
  }
  return data
}

export interface OwnRegistryRow {
  readonly person_id: string
  readonly barangay_id: string
  readonly barangay_name: string
  readonly first_name: string
  readonly last_name: string
  readonly application_id: string | null
  readonly state: string | null
  readonly info_request_note: string | null
  readonly decision_reason: string | null
  readonly submitted_at: string | null
  readonly evidence_count: number
}

/**
 * The caller's own registry state, or null before onboarding. RLS restricts
 * `persons` to the caller's linked record, so this cannot return anyone else.
 */
export async function fetchOwnRegistryState(): Promise<OwnRegistryRow | null> {
  const supabase = await createServerSupabaseClient()

  const { data: person, error: personError } = await supabase
    .from('persons')
    .select('id, barangay_id, first_name, last_name, barangays(name)')
    .maybeSingle()
  if (personError) {
    throw new Error(`own person query failed: ${personError.code}`)
  }
  if (!person) return null

  const { data: application, error: applicationError } = await supabase
    .from('verification_applications')
    .select('id, state, info_request_note, decision_reason, submitted_at')
    .eq('person_id', person.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (applicationError) {
    throw new Error(`own application query failed: ${applicationError.code}`)
  }

  let evidenceCount = 0
  if (application) {
    const { count, error: evidenceError } = await supabase
      .from('verification_evidence')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', application.id)
    if (evidenceError) {
      throw new Error(`own evidence query failed: ${evidenceError.code}`)
    }
    evidenceCount = count ?? 0
  }

  return {
    person_id: person.id,
    barangay_id: person.barangay_id,
    barangay_name: person.barangays?.name ?? 'Your barangay',
    first_name: person.first_name,
    last_name: person.last_name,
    application_id: application?.id ?? null,
    state: application?.state ?? null,
    info_request_note: application?.info_request_note ?? null,
    decision_reason: application?.decision_reason ?? null,
    submitted_at: application?.submitted_at ?? null,
    evidence_count: evidenceCount,
  }
}
