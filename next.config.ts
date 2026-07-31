import type { NextConfig } from 'next'

/**
 * Baseline security headers.
 *
 * A nonce-based Content-Security-Policy is added in Slice 1 (US-UI-002) once the
 * shells and their inline requirements are known. Phase 6 §34.2 forbids shipping a
 * permissive interim CSP, so none is set here rather than a weak one.
 *
 * `Referrer-Policy` is the global default. Registry and case routes tighten it to
 * `no-referrer` at the route level in Slice 2 (Phase 6 §30.3).
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // `camera=(self)` is required by FileUploader capture (Phase 5 §9.3).
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Development only. Playwright drives the dev server over 127.0.0.1 while
  // Next treats localhost as the origin; without this, every run prints a
  // cross-origin warning that trains people to ignore warnings.
  allowedDevOrigins: ['127.0.0.1'],
  typescript: {
    // Phase 6 §36.1 — type errors must fail the build, never be skipped.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
