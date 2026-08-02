import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

/**
 * 404 page.
 *
 * The wording is deliberately identical whether the record does not exist or
 * exists in another barangay. Distinguishing the two would confirm the existence
 * of a record to someone outside its tenant (Phase 4 §13.6).
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-prose px-4 py-16">
      <h1 className="text-2xl font-bold">We could not find that page</h1>
      <p className="mt-3 text-neutral-700">
        The link may be out of date, or the page may have been moved.
      </p>
      <p className="mt-6">
        <Link className="text-brand-700 font-medium underline" href="/">
          Return to the home page
        </Link>
      </p>
    </div>
  )
}
