import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Platform console',
  robots: { index: false, follow: false },
}

/**
 * PLT-01 placeholder.
 *
 * The real platform console — tenant list, provisioning, support grants, job
 * health — is built in Slice 9 / US-PLT-002.
 */
export default function PlatformHomePage() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-brand-700 text-sm font-medium tracking-wide uppercase">Slice 0a</p>
      <h1 className="mt-2 text-xl font-bold">Platform console</h1>
      <p className="mt-3 text-neutral-700">
        Placeholder for the platform shell. Tenant provisioning arrives in Slice 9.
      </p>
    </div>
  )
}
