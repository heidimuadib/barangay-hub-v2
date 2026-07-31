import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staff workspace',
  robots: { index: false, follow: false },
}

/**
 * STF-01 placeholder.
 *
 * The real staff home — today's queues, SLA breach counts, pending approvals —
 * is built in Slice 2 / US-STF-003.
 */
export default function StaffHomePage() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-brand-700 text-sm font-medium tracking-wide uppercase">Slice 0a</p>
      <h1 className="mt-2 text-xl font-bold">Staff workspace</h1>
      <p className="mt-3 text-neutral-700">
        Placeholder for the staff shell. Queue screens arrive in Slice 2.
      </p>
    </div>
  )
}
