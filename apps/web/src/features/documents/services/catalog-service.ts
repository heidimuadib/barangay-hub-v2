import 'server-only'

import { requireMembership } from '@/features/identity'

import {
  fetchActiveDocumentType,
  listActiveDocumentTypes,
} from '../repositories/documents-repository'
import type { CatalogEntry, DocumentTypeDetail } from '../types/documents'

/**
 * The resident-visible catalog (Slice 3B).
 *
 * Membership is the gate, not a capability: the catalog is what a barangay
 * offers its own residents, and 3A's RLS says the same thing
 * (`auth_is_active_member`). Verification is deliberately NOT required to
 * browse — an applicant waiting on a decision should be able to see what they
 * will be able to request, and find out what it needs. The gate lands on
 * CREATING a request, where it belongs.
 *
 * Inactive types are absent at every layer: the query filters them, the RLS
 * policy filters them, and `create_own_request` refuses them.
 */
export async function getResidentCatalog(barangayId: string): Promise<readonly CatalogEntry[]> {
  await requireMembership(barangayId)
  return listActiveDocumentTypes(barangayId)
}

/**
 * One catalog entry with its requirements, or null.
 *
 * Withdrawn, cross-tenant and never-existed all come back as the same null:
 * a resident probing ids must not be able to tell which of the three they hit
 * (Phase 4 §13.6). Callers decide what null means for them — a page renders
 * not-found, an action raises it.
 */
export async function getDocumentTypeDetail(
  barangayId: string,
  documentTypeId: string,
): Promise<DocumentTypeDetail | null> {
  await requireMembership(barangayId)
  return fetchActiveDocumentType(barangayId, documentTypeId)
}
