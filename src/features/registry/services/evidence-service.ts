import 'server-only'

import { can, requireAuthenticatedUser, requirePermission } from '@/features/identity'
import { NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'

import { REGISTRY_PERMISSIONS } from '../constants'
import {
  createEvidenceReadUrl,
  createEvidenceUploadTicket,
  removeEvidenceObject,
} from '../repositories/evidence-repository'
import * as registryRepo from '../repositories/registry-repository'
import { unwrap } from '../repositories/registry-repository'
import { fetchEvidenceSummaries } from '../repositories/verification-repository'
import { isAllowedEvidenceMime } from '../rules/evidence'
import type { EvidenceItem, EvidenceKind, EvidenceUploadTicket } from '../types/registry'

/**
 * Verification-evidence service (Slice 2F).
 *
 * The whole subpart runs on the caller's own session: no service-role client
 * is imported here or anywhere beneath it. Authorization is therefore decided
 * three times over — by the guard below, by the SECURITY DEFINER RPC, and by
 * the `storage.objects` policies — and the three cannot disagree, because the
 * Storage policies resolve through the very metadata row the RPC wrote.
 *
 * The client never chooses an object path. `add_evidence_metadata` generates
 * `{barangay}/{application}/{evidence}` server-side and returns it; a browser
 * that invents a path simply fails the INSERT policy.
 */

/** Metadata-before-upload, step 1: reserve the row, get a one-object ticket. */
export async function prepareEvidenceUpload(params: {
  applicationId: string
  kind: EvidenceKind
  mimeType: string
  declaredSizeBytes: number
}): Promise<EvidenceUploadTicket> {
  await requireAuthenticatedUser()

  // Re-screened server-side; the browser's MIME string is a hint. The bucket's
  // allowed_mime_types and the table CHECK refuse independently either way.
  if (!isAllowedEvidenceMime(params.mimeType)) {
    throw new NotFoundError('That file type is not accepted.')
  }

  // Ownership, tenant, application state and category are all re-decided
  // inside the definer function — this returns the opaque path it chose.
  const created = unwrap(
    await registryRepo.addEvidenceMetadata({
      p_application_id: params.applicationId,
      p_kind: params.kind,
      p_mime_type: params.mimeType,
      p_declared_size_bytes: params.declaredSizeBytes,
    }),
    'add_evidence_metadata',
  )

  const row = created[0]
  if (!row) {
    throw new NotFoundError('That registration could not be found.')
  }

  const ticket = await createEvidenceUploadTicket(row.storage_path)
  if (!ticket) {
    // The metadata row survives as a PENDING item the resident can retry or
    // remove; it satisfies nothing until an object is verified.
    logger.warn('Evidence upload ticket refused', { evidenceId: row.evidence_id })
    throw new NotFoundError('That upload could not be authorized.')
  }

  return { evidenceId: row.evidence_id, signedUrl: ticket.signedUrl }
}

/**
 * Step 2: finalize. The database re-reads `storage.objects` and takes the
 * size from the object itself, so a client that merely claims success
 * finalizes nothing — the call raises `EVIDENCE_OBJECT_MISSING`.
 */
export async function finalizeEvidenceUpload(params: {
  evidenceId: string
  contentHash: string
}): Promise<void> {
  await requireAuthenticatedUser()
  unwrap(
    await registryRepo.confirmEvidenceUpload({
      p_evidence_id: params.evidenceId,
      p_content_hash: params.contentHash,
    }),
    'confirm_evidence_upload',
  )
}

/**
 * Removal, with an honest consistency model.
 *
 * Storage and Postgres cannot share a transaction, so this is ordered rather
 * than atomic: the OBJECT is deleted first, and only then the metadata row.
 *
 *  - object delete fails      → nothing else happens; the item is unchanged
 *                               and the resident can retry. No silent success.
 *  - object gone, row remains → the item is still listed but its object is
 *                               missing; a retry deletes a missing object
 *                               (Storage treats that as success) and then
 *                               removes the row. The operation is idempotent.
 *
 * The reverse order was rejected: it would leave a row pointing at nothing
 * while reporting success. An orphaned OBJECT, by contrast, is inert — every
 * Storage policy resolves through a metadata row, so an object without one is
 * unreachable by anybody.
 */
export async function removeOwnEvidence(evidenceId: string): Promise<void> {
  await requireAuthenticatedUser()

  // The client names an evidence ID, never an object path. RLS scopes this
  // lookup to rows the caller may see; `remove_evidence` re-checks ownership
  // and the editable state before anything is deleted.
  const row = await registryRepo.fetchEvidencePath(evidenceId)
  if (!row) {
    throw new NotFoundError('That document could not be found.')
  }

  const objectRemoved = await removeEvidenceObject(row.storage_path)
  if (!objectRemoved) {
    logger.warn('Evidence object deletion failed; metadata left intact', { evidenceId })
    throw new NotFoundError('That document could not be removed. Please try again.')
  }

  // Ownership and editable-state are re-checked here; the audit entry is
  // written by trigger in the same transaction as the delete.
  unwrap(await registryRepo.removeEvidence({ p_evidence_id: evidenceId }), 'remove_evidence')
}

/** The resident's own evidence for one application (RLS-scoped). */
export async function listOwnEvidence(applicationId: string): Promise<readonly EvidenceItem[]> {
  await requireAuthenticatedUser()
  return (await fetchEvidenceSummaries(applicationId)).map(toItem)
}

function toItem(row: {
  id: string
  kind: string
  mime_type: string
  declared_size_bytes: number
  size_bytes: number | null
  uploaded_at: string | null
  created_at: string
}): EvidenceItem {
  return {
    evidenceId: row.id,
    kind: row.kind as EvidenceKind,
    mimeType: row.mime_type,
    declaredSizeBytes: row.declared_size_bytes,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
  }
}

/**
 * A short-lived read URL for one evidence object, issued ON DEMAND.
 *
 * Never called while rendering a page: staff review pages list metadata only,
 * and a reviewer asks for a document explicitly. The URL is returned to the
 * caller and never logged — a signed URL is a bearer credential.
 *
 * Reviewers need `verification.evidence.read` in the evidence's OWN barangay;
 * residents reach their own documents through ownership. Both are re-decided
 * by the Storage SELECT policy, so this guard is defence in depth.
 */
export async function requestEvidenceReadUrl(params: {
  barangayId: string
  evidenceId: string
}): Promise<string> {
  await requirePermission(params.barangayId, REGISTRY_PERMISSIONS.evidenceRead)

  const row = await registryRepo.fetchEvidencePath(params.evidenceId, params.barangayId)
  // Wrong tenant, nonexistent, and not-finalized are one answer.
  if (!row || row.uploaded_at === null) {
    throw new NotFoundError('That document could not be found.')
  }

  const url = await createEvidenceReadUrl(row.storage_path)
  if (!url) {
    throw new NotFoundError('That document could not be found.')
  }

  // IDs only. The URL itself is a credential and never enters a log line.
  logger.info('Evidence read URL issued', { evidenceId: params.evidenceId })
  return url
}

/** True when the caller may be OFFERED a view control (UI convenience). */
export function canReadEvidence(context: Parameters<typeof can>[0], barangayId: string): boolean {
  return can(context, barangayId, REGISTRY_PERMISSIONS.evidenceRead)
}
