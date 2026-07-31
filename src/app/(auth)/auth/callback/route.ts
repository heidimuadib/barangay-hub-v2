import { NextResponse } from 'next/server'

import { getAuthorizationContext, landingRouteFor } from '@/features/identity'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * PKCE auth callback (confirmation and recovery links). Password sign-in does
 * not pass through here, but the local stack's redirect allow-list and later
 * email flows do. Failure lands on the sign-in screen with no detail — the
 * email link itself is the only party that knows what failed.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (code !== null) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const context = await getAuthorizationContext()
      if (context) {
        return NextResponse.redirect(new URL(landingRouteFor(context), url.origin))
      }
    }
    logger.warn('Auth callback failed to establish a session')
  }

  return NextResponse.redirect(new URL('/sign-in', url.origin))
}
