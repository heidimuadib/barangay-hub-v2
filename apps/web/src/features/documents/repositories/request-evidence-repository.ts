import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Private-bucket Storage operations for request evidence (Slice 3D).
 *
 * Deliberately the same shape as the Slice 2F verification broker, because it
 * solves the same problem: every call runs on the CALLER'S OWN session, no
 * service-role client appears here or beneath it, and the `storage.objects`
 * policies from migration 20260808010000 decide each operation by joining the
 * object name back to `document_request_evidence.storage_path`. Storage
 * authorization and metadata authorization therefore cannot drift apart.
 *
 * The bucket name is an implementation detail: it reaches the browser only
 * inside a signed ticket, never in ordinary UI.
 */

export const REQUEST_EVIDENCE_BUCKET = 'request-evidence'

/** Short: the ticket is used immediately by the page that requested it. */
const UPLOAD_URL_TTL_SECONDS = 120

/** Short: a reviewer opens the document now, or asks again. */
const READ_URL_TTL_SECONDS = 60

export interface SignedUploadTicket {
  /**
   * A complete, self-contained upload URL carrying its own token. The browser
   * PUTs the file straight to it — deliberately NOT the supabase-js client,
   * which would pull the environment schema into the client bundle.
   */
  readonly signedUrl: string
  readonly path: string
}

/**
 * Authorization to write exactly ONE object. Supabase issues this only when
 * the caller passes the bucket's INSERT policy, so nobody can obtain a ticket
 * for another person's path, another tenant, or a submitted request.
 */
export async function createRequestEvidenceUploadTicket(
  storagePath: string,
): Promise<SignedUploadTicket | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.storage
    .from(REQUEST_EVIDENCE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (error) {
    // Denials and missing objects are indistinguishable on purpose: the caller
    // learns only that it did not work (Phase 4 §13.6).
    return null
  }
  return { signedUrl: data.signedUrl, path: data.path }
}

/** A short-lived read URL for one exact object, or null on any refusal. */
export async function createRequestEvidenceReadUrl(storagePath: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.storage
    .from(REQUEST_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, READ_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/**
 * Removes one object. Storage treats deleting a missing object as success,
 * which is what makes the removal flow idempotent and safe to retry after a
 * partial failure.
 */
export async function removeRequestEvidenceObject(storagePath: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.storage.from(REQUEST_EVIDENCE_BUCKET).remove([storagePath])
  return !error
}

// ── Metadata reads ──────────────────────────────────────────────────────────

export interface RequestEvidenceRow {
  readonly id: string
  readonly mime_type: string
  readonly declared_size_bytes: number
  readonly size_bytes: number | null
  readonly uploaded_at: string | null
  readonly created_at: string
}

/**
 * Evidence METADATA for one request. RLS admits only the requester or a holder
 * of `requests.evidence.read`, so a caller without either gets an empty list —
 * which is why the SERVICE decides from the capability whether "empty" means
 * "no documents" or "not yours to see".
 */
export async function fetchRequestEvidence(
  requestId: string,
): Promise<readonly RequestEvidenceRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('document_request_evidence')
    .select('id, mime_type, declared_size_bytes, size_bytes, uploaded_at, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`request evidence query failed: ${error.code}`)
  }
  return data ?? []
}

/** One evidence row's opaque path, for the broker. Never sent to a browser. */
export async function fetchRequestEvidencePath(
  evidenceId: string,
  barangayId?: string,
): Promise<{ storage_path: string; uploaded_at: string | null } | null> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('document_request_evidence')
    .select('storage_path, uploaded_at')
    .eq('id', evidenceId)
  if (barangayId !== undefined) {
    query = query.eq('barangay_id', barangayId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(`request evidence path query failed: ${error.code}`)
  }
  return data
}

export { UPLOAD_URL_TTL_SECONDS, READ_URL_TTL_SECONDS }
