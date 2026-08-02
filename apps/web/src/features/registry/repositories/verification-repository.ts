import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import type { VerificationState } from '../types/registry'

/**
 * Staff verification-queue reads (Slice 2D). Every query is additionally
 * constrained by RLS (`verification.read` on applications; evidence rows by
 * `verification.evidence.read`); the explicit `barangay_id` filters are
 * correctness and index use, not the security boundary.
 */

interface QueuePersonRow {
  readonly id: string
  readonly first_name: string
  readonly middle_name: string | null
  readonly last_name: string
  readonly suffix: string | null
  readonly source_channel: string
  readonly person_accounts: { user_id: string }[]
}

export interface QueueApplicationRow {
  readonly id: string
  readonly state: string
  readonly submitted_at: string | null
  readonly created_at: string
  readonly persons: QueuePersonRow
}

const QUEUE_COLUMNS =
  'id, state, submitted_at, created_at, persons(id, first_name, middle_name, last_name, suffix, source_channel, person_accounts(user_id))'

export interface QueuePage {
  readonly rows: readonly QueueApplicationRow[]
  readonly total: number
}

/**
 * One page of the tenant queue, oldest waiting first: `submitted_at`
 * ascending (a resubmission keeps its original submission time, so it does
 * not jump the line), then `created_at` for drafts that were never submitted.
 */
export async function fetchQueuePage(params: {
  barangayId: string
  states: readonly VerificationState[]
  limit: number
  offset: number
}): Promise<QueuePage> {
  const supabase = await createServerSupabaseClient()
  const { data, error, count } = await supabase
    .from('verification_applications')
    .select(QUEUE_COLUMNS, { count: 'exact' })
    .eq('barangay_id', params.barangayId)
    .in('state', [...params.states])
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .range(params.offset, params.offset + params.limit - 1)

  if (error) {
    throw new Error(`verification queue query failed: ${error.code}`)
  }
  return { rows: data, total: count ?? 0 }
}

export interface ApplicationDetailRow {
  readonly id: string
  readonly state: string
  readonly submitted_at: string | null
  readonly created_at: string
  readonly decided_at: string | null
  readonly info_request_note: string | null
  readonly decision_reason: string | null
  readonly persons: QueuePersonRow & {
    readonly birthdate: string | null
    readonly contact_phone: string | null
    readonly address_line: string | null
    readonly residency_basis_key: string
    readonly residency_basis_explanation: string | null
    readonly superseded_by: string | null
  }
}

const DETAIL_COLUMNS =
  'id, state, submitted_at, created_at, decided_at, info_request_note, decision_reason, persons(id, first_name, middle_name, last_name, suffix, birthdate, contact_phone, address_line, residency_basis_key, residency_basis_explanation, source_channel, superseded_by, person_accounts(user_id))'

export async function fetchApplicationDetail(
  barangayId: string,
  applicationId: string,
): Promise<ApplicationDetailRow | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('verification_applications')
    .select(DETAIL_COLUMNS)
    .eq('barangay_id', barangayId)
    .eq('id', applicationId)
    .maybeSingle()

  if (error) {
    throw new Error(`application detail query failed: ${error.code}`)
  }
  return data
}

export interface EvidenceRow {
  readonly id: string
  readonly kind: string
  readonly mime_type: string
  readonly declared_size_bytes: number
  readonly size_bytes: number | null
  readonly uploaded_at: string | null
  readonly created_at: string
}

/**
 * Evidence METADATA for one application. RLS admits only the application's
 * owner or `verification.evidence.read` holders — a caller without either
 * gets an empty list, so the SERVICE decides from the capability whether an
 * empty result means "no documents" or "not yours to see".
 */
export async function fetchEvidenceSummaries(
  applicationId: string,
): Promise<readonly EvidenceRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('verification_evidence')
    .select('id, kind, mime_type, declared_size_bytes, size_bytes, uploaded_at, created_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`evidence summary query failed: ${error.code}`)
  }
  return data
}
