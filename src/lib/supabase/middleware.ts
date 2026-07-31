import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { clientEnv } from '@/lib/config/env.client'
import type { Database } from '@/types/database.types'

/**
 * Refreshes the Supabase auth session on every request.
 *
 * Runs in the Edge runtime, so it uses public configuration only. It performs
 * NO authorization — that is the action chain's job (Phase 3 §5.5). Its single
 * responsibility is keeping the session cookies current.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; isAuthenticated: boolean }> {
  let response = NextResponse.next({ request })

  // Annotated explicitly — see the note in server.ts about the deprecated
  // overload preventing contextual typing of `setAll`.
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll()
    },
    setAll(cookiesToSet) {
      for (const { name, value } of cookiesToSet) {
        request.cookies.set(name, value)
      }
      response = NextResponse.next({ request })
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options)
      }
    },
  }

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: cookieMethods },
  )

  // getUser() revalidates the token with Supabase Auth. Do not replace this with
  // getSession(), which trusts the cookie without verification.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, isAuthenticated: user !== null }
}
