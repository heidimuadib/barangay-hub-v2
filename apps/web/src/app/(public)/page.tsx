import type { Metadata } from 'next'
import Link from 'next/link'

import { getPublicBarangays } from '@/features/documents'

export const metadata: Metadata = {
  title: 'Barangay Hub',
  description:
    'Find out what documents your barangay issues, what each one needs, and how to request it.',
}

/**
 * The public home page (US-UI-006), replacing the Slice 0a placeholder.
 *
 * Anonymous by design: no session, no cookie read, no personal data of any
 * kind. What it can reach is bounded by the `anon` grant from migration
 * 20260808020000 — the two catalog tables and a name-only barangay directory —
 * so there is nothing here to leak even if this page were wrong.
 *
 * The purpose is to save a trip. Someone can find out what a document costs,
 * how long it takes and what to bring BEFORE travelling to the barangay hall,
 * which is the whole point of a civic portal — and the reason the placeholder
 * fees carry their "not yet confirmed" marking here as loudly as anywhere else.
 */
export default async function PublicHomePage() {
  const barangays = await getPublicBarangays()

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-bold">Barangay documents, without the guesswork</h1>
        <p className="mt-3 max-w-prose text-neutral-700">
          Find out what your barangay issues, what each document needs and how long it takes —
          before you travel there. You do not need an account to look.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/sign-in"
            className="bg-brand-700 hover:bg-brand-800 inline-flex min-h-11 items-center rounded-md px-4 py-2 font-medium text-white"
          >
            Sign in to request a document
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
          >
            Create an account
          </Link>
        </div>
      </div>

      <section
        aria-labelledby="barangays-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="barangays-heading" className="text-lg font-bold">
          Choose your barangay
        </h2>
        {barangays.length === 0 ? (
          <p className="mt-3 text-neutral-700">No barangay is publishing its documents here yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {barangays.map((barangay) => (
              <li key={barangay.id}>
                <Link
                  href={`/catalog/${barangay.id}`}
                  className="text-brand-700 inline-flex min-h-11 items-center font-medium hover:underline"
                >
                  {barangay.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-neutral-500">
        Requesting a document needs an account, and your barangay confirms who you are before your
        first request.
      </p>
    </div>
  )
}
