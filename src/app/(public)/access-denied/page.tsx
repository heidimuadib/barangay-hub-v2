import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Access denied',
  robots: { index: false, follow: false },
}

/**
 * Neutral denial screen. The copy never says WHAT was denied or WHY — naming
 * the missing permission or the tenant would turn every denial into
 * reconnaissance (Phase 4 §13.6).
 */
export default function AccessDeniedPage() {
  return (
    <div className="mx-auto max-w-prose rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-bold">You do not have access to that page</h1>
      <p className="mt-3 text-neutral-700">
        Your account is signed in, but it is not set up for the page you tried to open. If you
        believe you should have access, contact your barangay administrator.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/dashboard"
          className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white"
        >
          Go to my dashboard
        </Link>
        <Link
          href="/"
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Home
        </Link>
      </div>
    </div>
  )
}
