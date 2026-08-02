import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home',
}

/**
 * PUB-01 placeholder.
 *
 * The real public home page — three civic task cards, announcements, office
 * information — is built in Slice 1 / US-UI-006. This placeholder exists so the
 * application builds and the Slice 0a foundation can be verified end to end.
 */
export default function PublicHomePage() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-brand-700 text-sm font-medium tracking-wide uppercase">Slice 0a</p>
      <h1 className="mt-2 text-2xl font-bold">Barangay Hub v2 — engineering foundation</h1>
      <p className="mt-3 max-w-prose">
        This placeholder confirms the application skeleton, design tokens and build pipeline are
        working. The public portal is implemented in Slice 1.
      </p>
      <p className="mt-4 text-sm text-neutral-500">
        Health check:{' '}
        <a className="text-brand-700 underline" href="/api/health">
          /api/health
        </a>
      </p>
    </div>
  )
}
