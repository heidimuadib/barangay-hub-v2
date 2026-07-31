import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My dashboard',
  robots: { index: false, follow: false },
}

/**
 * RES-01 placeholder.
 *
 * The real resident dashboard — active requests, next actions, verification
 * status, announcements — is built in Slice 3 / US-RES-004.
 */
export default function ResidentDashboardPage() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-brand-700 text-sm font-medium tracking-wide uppercase">Slice 0a</p>
      <h1 className="mt-2 text-xl font-bold">Resident dashboard</h1>
      <p className="mt-3 text-neutral-700">
        Placeholder for the resident shell. No data is loaded and no session is required yet.
      </p>
    </div>
  )
}
