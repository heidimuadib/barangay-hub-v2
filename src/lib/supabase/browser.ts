import { createBrowserClient } from '@supabase/ssr'

import { clientEnv } from '@/lib/config/env.client'
import type { Database } from '@/types/database.types'

/**
 * Supabase client for Client Components.
 *
 * Uses the anon key only. Every read and write it performs is subject to RLS
 * (Phase 3 ADR-02). The browser never mutates domain state directly — mutations
 * go through Server Actions (Phase 3 ADR-01). This client exists for Realtime
 * subscriptions and Auth session reads.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
