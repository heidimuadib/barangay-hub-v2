import 'server-only'

import { updateOwnDisplayName } from '../repositories/identity-repository'

/**
 * Profile mutations. The row restriction (own profile) and the column
 * restriction (display_name only) are enforced by RLS and the column grant;
 * the database trigger audits the change in the same transaction.
 */
export async function updateDisplayName(userId: string, displayName: string): Promise<boolean> {
  return updateOwnDisplayName(userId, displayName)
}
