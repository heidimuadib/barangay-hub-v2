import { NextResponse } from 'next/server'

import { env } from '@/lib/config/env.server'
import { CORRELATION_HEADER, newCorrelationId } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Liveness probe.
 *
 * Deliberately shallow and unrevealing (Phase 6 §6.3): it confirms the process is
 * up and its configuration validated, and discloses nothing about internal
 * topology. A readiness probe that checks the database and job queues is added in
 * Slice 1 as an authenticated platform endpoint (PLT-08), not here — a public
 * endpoint that touches the database is an amplification vector.
 */
export function GET(request: Request): NextResponse {
  const correlationId = request.headers.get(CORRELATION_HEADER) ?? newCorrelationId()

  return NextResponse.json(
    {
      status: 'ok',
      appEnv: env.APP_ENV,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        [CORRELATION_HEADER]: correlationId,
        'Cache-Control': 'no-store',
      },
    },
  )
}
