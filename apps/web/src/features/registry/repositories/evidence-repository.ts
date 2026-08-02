import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Private-bucket Storage operations for verification evidence (Slice 2F).
 *
 * Every call runs on the CALLER'S OWN session. There is no service-role
 * client anywhere in this module — the `storage.objects` policies added by
 * migration 20260805010000 decide each operation by joining the object name
 * to `verification_evidence.storage_path`, so Storage authorization and the
 * metadata authorization cannot drift apart.
 *
 * The bucket name is an implementation detail: it never reaches the browser
 * except inside a signed-upload ticket, and never appears in ordinary UI.
 */

export const EVIDENCE_BUCKET = 'verification-evidence'

/** Short: the ticket is used immediately by the page that requested it. */
const UPLOAD_URL_TTL_SECONDS = 120

/** Short: a reviewer opens the document now, or asks again. */
const READ_URL_TTL_SECONDS = 60

export interface SignedUploadTicket {
  /**
   * A complete, self-contained upload URL carrying its own token. The browser
   * PUTs the file straight to it — deliberately NOT the supabase-js client,
   * which would pull the environment schema into the client bundle and ship
   * the names of every server secret to the browser.
   */
  readonly signedUrl: string
  readonly path: string
}

/**
 * Authorization to write exactly ONE object. Supabase issues this only when
 * the caller passes the bucket's INSERT policy, so a resident cannot obtain a
 * ticket for another person's path, another tenant, or a frozen application.
 */
export async function createEvidenceUploadTicket(
  storagePath: string,
): Promise<SignedUploadTicket | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (error) {
    // Denials and missing objects are indistinguishable on purpose: the
    // caller learns only that it did not work (Phase 4 §13.6).
    return null
  }
  return { signedUrl: data.signedUrl, path: data.path }
}

/**
 * A short-lived read URL for one exact object. Returns null when the caller
 * fails the SELECT policy — the same answer a nonexistent object gives.
 */
export async function createEvidenceReadUrl(storagePath: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, READ_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/**
 * Removes one object. Storage treats deleting a missing object as success,
 * which is what makes the removal flow idempotent and safe to retry after a
 * partial failure (see the consistency model in the architecture doc).
 */
export async function removeEvidenceObject(storagePath: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath])
  return !error
}

export { UPLOAD_URL_TTL_SECONDS, READ_URL_TTL_SECONDS }
