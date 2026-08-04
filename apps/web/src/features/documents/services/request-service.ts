import 'server-only'

import { requireAuthenticatedUser } from '@/features/identity'

import {
  fetchOwnRequest,
  fetchResidentStanding,
  listOwnRequests,
} from '../repositories/documents-repository'
import type { OwnRequestDetail, OwnRequestSummary, ResidentStanding } from '../types/documents'

/**
 * The resident's own requests (Slice 3B).
 *
 * Authentication is required; no capability is. Ownership is resolved through
 * the account↔person link and passed down as a filter, so "own requests only"
 * holds in the query as well as in RLS — a staff member holding
 * `requests.read` who navigates to a resident route still sees only their own.
 */

export const REQUESTS_PAGE_SIZE = 10

export interface OwnRequestListPage {
  readonly entries: readonly OwnRequestSummary[]
  readonly page: number
  readonly pageCount: number
  readonly total: number
}

/** Where the caller stands as a resident of this barangay. */
export async function getResidentStanding(barangayId: string): Promise<ResidentStanding> {
  const context = await requireAuthenticatedUser()
  return fetchResidentStanding(barangayId, context.userId)
}

export async function listOwnRequestPage(
  barangayId: string,
  requestedPage: number,
): Promise<OwnRequestListPage> {
  const context = await requireAuthenticatedUser()
  const standing = await fetchResidentStanding(barangayId, context.userId)

  // No person record means no requests can exist — an empty list, not an
  // error: the caller is simply someone who has not registered here.
  if (standing.personId === null) {
    return { entries: [], page: 1, pageCount: 1, total: 0 }
  }

  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1
  const offset = (page - 1) * REQUESTS_PAGE_SIZE

  const result = await listOwnRequests(barangayId, standing.personId, offset, REQUESTS_PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(result.total / REQUESTS_PAGE_SIZE))

  return { entries: result.entries, page, pageCount, total: result.total }
}

/**
 * One of the caller's own requests, or null.
 *
 * Another resident's request id comes back as the same null as a nonexistent
 * one — the refusal must not confirm that the id is real (Phase 4 §13.6).
 */
export async function getOwnRequestDetail(
  barangayId: string,
  requestId: string,
): Promise<OwnRequestDetail | null> {
  const context = await requireAuthenticatedUser()
  const standing = await fetchResidentStanding(barangayId, context.userId)
  if (standing.personId === null) return null

  return fetchOwnRequest(barangayId, standing.personId, requestId)
}
