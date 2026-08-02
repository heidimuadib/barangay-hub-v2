import { NextResponse, type NextRequest } from 'next/server'

import { clientEnv } from '@/lib/config/env.client'
import { CORRELATION_HEADER, newCorrelationId } from '@/lib/logger/correlation'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Edge middleware (Phase 3 §5.5): session cookie refresh, correlation ID
 * assignment, the nonce-based Content-Security-Policy, and coarse route
 * gating. The gating is DEFENCE-IN-DEPTH ONLY — authorization lives in the
 * Server Action chain and in RLS; an unauthenticated request is bounced here
 * merely to save a render that would bounce anyway.
 */

const PROTECTED_PREFIXES = ['/dashboard', '/staff', '/platform', '/account']

/**
 * Nonce-based CSP (Phase 6 §34.2 — permissive interim policies are forbidden,
 * so this ships strict from the start). Development needs 'unsafe-eval' and a
 * websocket source for React Fast Refresh; neither survives into production.
 */
function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const supabaseOrigin = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).origin

  const scriptSrc = [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`]
  if (isDev) scriptSrc.push(`'unsafe-eval'`)

  const connectSrc = [`'self'`, supabaseOrigin]
  if (isDev) connectSrc.push('ws:')

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    // Next.js injects inline style attributes during streaming; nonce-based
    // style-src would break hydration. Styles carry no execution risk here.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src ${connectSrc.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ')
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const correlationId = request.headers.get(CORRELATION_HEADER) ?? newCorrelationId()
  const nonce = btoa(crypto.randomUUID())
  const csp = buildContentSecurityPolicy(nonce)

  // Both headers must be set BEFORE updateSession snapshots the request:
  // downstream server rendering reads the CSP header to stamp the nonce onto
  // the framework's own scripts, and route handlers read the correlation ID.
  request.headers.set(CORRELATION_HEADER, correlationId)
  request.headers.set('content-security-policy', csp)

  const { response, isAuthenticated } = await updateSession(request)

  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('content-security-policy', csp)

  if (!isAuthenticated && isProtectedPath(request.nextUrl.pathname)) {
    // No ?next= parameter by design: the post-sign-in destination is computed
    // from the authorization context, and a return-to parameter is both an
    // open-redirect surface and a URL-hygiene liability (P6-C-E).
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/sign-in'
    signInUrl.search = ''

    const redirect = NextResponse.redirect(signInUrl)
    // Preserve any session cookies updateSession just refreshed.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    redirect.headers.set(CORRELATION_HEADER, correlationId)
    redirect.headers.set('content-security-policy', csp)
    return redirect
  }

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
