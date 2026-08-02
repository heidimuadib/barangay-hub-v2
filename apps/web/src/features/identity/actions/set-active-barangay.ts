'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { ACTIVE_BARANGAY_COOKIE } from '../constants'
import { activeMembership } from '../rules/access-rules'
import { requireAuthenticatedUser } from '../services/authorization'

/**
 * Persists the barangay a multi-membership user is working in.
 *
 * The submitted id is validated against the caller's LIVE memberships before
 * it is stored, and validated again on every later read
 * (`resolveActiveBarangay`) — the cookie is a pointer, never an authority.
 */
export async function setActiveBarangayAction(formData: FormData): Promise<void> {
  const context = await requireAuthenticatedUser()

  const requested = formData.get('barangayId')
  const membership = typeof requested === 'string' ? activeMembership(context, requested) : null

  if (membership) {
    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_BARANGAY_COOKIE, membership.barangayId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  // An invalid selection is silently ignored: the fallback resolution picks
  // the first active membership, and there is nothing useful to tell the user
  // beyond what the switcher already shows.

  redirect('/staff')
}
