'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'

import { ACTIVE_BARANGAY_COOKIE } from '../constants'
import { appendCallerAuditEntry, getAuthorizationContext } from '../services/authorization'

export async function signOutAction(): Promise<void> {
  const context = await getAuthorizationContext()

  if (context) {
    try {
      // Audited BEFORE the session is destroyed — afterwards there is no
      // caller identity left to attribute the event to.
      await appendCallerAuditEntry({
        action: 'auth.sign_out',
        targetType: 'session',
        outcome: 'success',
      })
    } catch (error) {
      logger.error('Audit write failed for sign-out', {
        userId: context.userId,
        cause: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_BARANGAY_COOKIE)

  redirect('/sign-in')
}
