import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, buttonClasses } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Access denied',
  robots: { index: false, follow: false },
}

/**
 * Neutral denial screen. The copy never says WHAT was denied or WHY — naming
 * the missing permission or the tenant would turn every denial into
 * reconnaissance (Phase 4 §13.6).
 *
 * UI-A note: the two calls to action were `min-h-11` on a `next/link`, which
 * renders an inline `<a>` — a min-height an inline box ignores, so the 44px was
 * declared and not applied. `buttonClasses` carries `inline-flex`, which is what
 * makes the floor real.
 */
export default function AccessDeniedPage() {
  return (
    <Card className="mx-auto max-w-prose">
      <h1 className="text-xl font-bold">You do not have access to that page</h1>
      <p className="mt-3 text-neutral-700">
        Your account is signed in, but it is not set up for the page you tried to open. If you
        believe you should have access, contact your barangay administrator.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard" className={buttonClasses()}>
          Go to my dashboard
        </Link>
        <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
          Home
        </Link>
      </div>
    </Card>
  )
}
