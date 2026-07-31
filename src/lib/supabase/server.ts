import 'server-only'

import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from '@/lib/config/env.server'
import type { Database } from '@/types/database.types'

/**
 * Request-scoped Supabase client carrying the caller's JWT.
 *
 * This is the DEFAULT client for all server code. It is subject to RLS, which is
 * what makes RLS a real backstop rather than decoration (Phase 3 ADR-02).
 * Use `createServiceRoleClient` only for the eight named system operations.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  // Annotated explicitly: `createServerClient` is overloaded, and the deprecated
  // get/set/remove overload is tried first, so the object literal would not be
  // contextually typed and `setAll`'s parameter would be an implicit `any`.
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options)
        }
      } catch {
        // Called from a Server Component, where cookies are read-only.
        // Session refresh is handled by middleware, so this is safe to ignore.
      }
    },
  }

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: cookieMethods },
  )
}
