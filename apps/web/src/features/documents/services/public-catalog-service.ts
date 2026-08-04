import 'server-only'

import type { CatalogEntry } from '../types/documents'
import {
  listPublicBarangays,
  listPublicCatalog,
  type PublicBarangay,
} from '../repositories/public-catalog-repository'

/**
 * The public catalog service (US-UI-006).
 *
 * The only service in this feature with NO authorization guard — deliberately,
 * and this comment is the record of why. Every other read here begins with
 * `requireMembership` or `requirePermission`; this one begins with nothing,
 * because its audience is a person who has not signed in and may never do so.
 *
 * What makes that safe is not this layer. It is that migration 20260808020000
 * granted `anon` SELECT on exactly two tables, under policies that admit only
 * ACTIVE types in ACTIVE barangays — and `db:reset:verified` fails if that
 * grant ever widens. This service cannot read a request, a person, an answer
 * or a piece of evidence even if a future edit here asked it to.
 */

export type { PublicBarangay }

export async function getPublicBarangays(): Promise<readonly PublicBarangay[]> {
  return listPublicBarangays()
}

export async function getPublicCatalog(barangayId: string): Promise<readonly CatalogEntry[]> {
  return listPublicCatalog(barangayId)
}
