import 'server-only'

import { can, requireAuthenticatedUser, requirePermission } from '@/features/identity'
import { NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'

import { DOCUMENT_PERMISSIONS } from '../constants'
import {
  addRequestEvidenceMetadata,
  confirmRequestEvidenceUpload,
  removeRequestEvidence,
  unwrap,
} from '../repositories/documents-repository'
import {
  createRequestEvidenceReadUrl,
  createRequestEvidenceUploadTicket,
  fetchRequestEvidence,
  fetchRequestEvidencePath,
  removeRequestEvidenceObject,
} from '../repositories/request-evidence-repository'
import { isAllowedRequestEvidenceMime } from '../rules/request-evidence'
import type { RequestEvidenceItem, RequestEvidenceUploadTicket } from '../types/documents'

/**
 * Supporting-evidence service (Slice 3D).
 *
 * The whole subpart runs on the caller's own session: no service-role client
 * is imported here or anywhere beneath it. Authorization is decided three
 * times over — by the guard below, by the SECURITY DEFINER RPC, and by the
 * `storage.objects` policies — and the three cannot disagree, because the
 * Storage policies resolve through the very metadata row the RPC wrote.
 *
 * The client never chooses an object path. `add_request_evidence_metadata`
 * generates `{barangay}/{request}/{evidence}` server-side and returns it; a
 * browser that invents a path simply fails the INSERT policy.
 */

/** Metadata-before-upload, step 1: reserve the row, get a one-object ticket. */
export async function prepareRequestEvidenceUpload(params: {
  requestId: string
  mimeType: string
  declaredSizeBytes: number
}): Promise<RequestEvidenceUploadTicket> {
  await requireAuthenticatedUser()

  // Re-screened server-side; the browser's MIME string is a hint. The bucket's
  // allowed_mime_types and the column CHECK refuse independently either way.
  if (!isAllowedRequestEvidenceMime(params.mimeType)) {
    throw new NotFoundError('That file type is not accepted.')
  }

  // Ownership, tenant and request state are all re-decided inside the definer
  // function — this returns the opaque path it chose.
  const created = unwrap(
    await addRequestEvidenceMetadata({
      p_request_id: params.requestId,
      p_mime_type: params.mimeType,
      p_declared_size_bytes: params.declaredSizeBytes,
    }),
    'add_request_evidence_metadata',
  )

  const row = created[0]
  if (!row) {
    throw new NotFoundError('That request could not be found.')
  }

  const ticket = await createRequestEvidenceUploadTicket(row.storage_path)
  if (!ticket) {
    // The metadata row survives as a PENDING item the resident can retry or
    // remove; it satisfies the submission gate no more than nothing does.
    logger.warn('Request evidence upload ticket refused', { evidenceId: row.evidence_id })
    throw new NotFoundError('That upload could not be authorized.')
  }

  return { evidenceId: row.evidence_id, signedUrl: ticket.signedUrl }
}

/**
 * Step 2: finalize. The database re-reads `storage.objects` and takes the size
 * from the object itself, so a client that merely claims success finalizes
 * nothing — the call raises `EVIDENCE_OBJECT_MISSING`.
 */
export async function finalizeRequestEvidenceUpload(params: {
  evidenceId: string
  contentHash: string
}): Promise<void> {
  await requireAuthenticatedUser()
  unwrap(
    await confirmRequestEvidenceUpload({
      p_evidence_id: params.evidenceId,
      p_content_hash: params.contentHash,
    }),
    'confirm_request_evidence_upload',
  )
}

/**
 * Removal, with the same honest consistency model as Slice 2F.
 *
 * Storage and Postgres cannot share a transaction, so this is ordered rather
 * than atomic: the OBJECT goes first, the metadata row second.
 *
 *  - object delete fails      → nothing else happens; the item is unchanged
 *                               and the resident can retry. No silent success.
 *  - object gone, row remains → the item is still listed but carries nothing;
 *                               a retry deletes a missing object (Storage
 *                               calls that success) and then removes the row.
 *
 * The reverse order was rejected: it would leave a row pointing at nothing
 * while reporting success. An orphaned OBJECT is inert — every Storage policy
 * resolves through a metadata row, so an object without one is unreachable.
 */
export async function removeOwnRequestEvidence(evidenceId: string): Promise<void> {
  await requireAuthenticatedUser()

  const row = await fetchRequestEvidencePath(evidenceId)
  if (!row) {
    throw new NotFoundError('That document could not be found.')
  }

  const objectRemoved = await removeRequestEvidenceObject(row.storage_path)
  if (!objectRemoved) {
    logger.warn('Request evidence object deletion failed; metadata left intact', { evidenceId })
    throw new NotFoundError('That document could not be removed. Please try again.')
  }

  unwrap(await removeRequestEvidence({ p_evidence_id: evidenceId }), 'remove_request_evidence')
}

/** The evidence attached to one request (RLS-scoped to owner or capability). */
export async function listRequestEvidence(
  requestId: string,
): Promise<readonly RequestEvidenceItem[]> {
  await requireAuthenticatedUser()
  return (await fetchRequestEvidence(requestId)).map((row) => ({
    evidenceId: row.id,
    mimeType: row.mime_type,
    declaredSizeBytes: row.declared_size_bytes,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
  }))
}

/**
 * A short-lived read URL for one evidence object, issued ON DEMAND.
 *
 * Never called while rendering a page: the staff detail lists metadata only,
 * and a reviewer asks for a document explicitly. The URL is returned to the
 * caller and never logged — a signed URL is a bearer credential.
 */
export async function requestEvidenceReadUrl(params: {
  barangayId: string
  evidenceId: string
}): Promise<string> {
  await requirePermission(params.barangayId, DOCUMENT_PERMISSIONS.evidenceRead)

  const row = await fetchRequestEvidencePath(params.evidenceId, params.barangayId)
  // Wrong tenant, nonexistent and not-finalized are one answer.
  if (!row || row.uploaded_at === null) {
    throw new NotFoundError('That document could not be found.')
  }

  const url = await createRequestEvidenceReadUrl(row.storage_path)
  if (!url) {
    throw new NotFoundError('That document could not be found.')
  }

  // IDs only. The URL itself is a credential and never enters a log line.
  logger.info('Request evidence read URL issued', { evidenceId: params.evidenceId })
  return url
}

/** True when the caller may be OFFERED a view control (UI convenience). */
export function canReadRequestEvidence(
  context: Parameters<typeof can>[0],
  barangayId: string,
): boolean {
  return can(context, barangayId, DOCUMENT_PERMISSIONS.evidenceRead)
}
