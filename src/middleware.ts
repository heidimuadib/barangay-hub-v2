import type { NextRequest, NextResponse } from 'next/server'

import { CORRELATION_HEADER, newCorrelationId } from '@/lib/logger/correlation'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Edge middleware.
 *
 * Responsibilities (Phase 3 §5.5): session cookie refresh, correlation ID
 * assignment, and coarse route gating. It performs NO authorization — fine-grained
 * checks live in the Server Action chain and in RLS. Route gating lands in
 * Slice 1 (US-UI-002) once the shells exist.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const correlationId = request.headers.get(CORRELATION_HEADER) ?? newCorrelationId()

  // Must be set BEFORE updateSession, which calls NextResponse.next({ request }).
  // That call snapshots the request headers, and the snapshot is what downstream
  // route handlers and Server Components receive.
  request.headers.set(CORRELATION_HEADER, correlationId)

  const { response } = await updateSession(request)

  // Also expose it to the browser so a user can quote it to support.
  response.headers.set(CORRELATION_HEADER, correlationId)

  return response
}

export const config = {
  matcher: [
    /**
     * Everything except static assets, image optimisation, favicon and cron
     * endpoints. Cron routes authenticate with a shared secret and must not be
     * subject to session handling (Phase 6 §27.1).
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
