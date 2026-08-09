import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { Alert, Card, PageHeader } from '@/components/ui'
import {
  ACTIVE_BARANGAY_COOKIE,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'

export const metadata: Metadata = {
  title: 'Staff workspace',
  robots: { index: false, follow: false },
}

/**
 * Staff home.
 *
 * Still a landing page rather than a dashboard: the statistic row, the
 * needs-action panel and the recent-activity list that the legacy
 * `admindash.php` had are UI-D work, and they read from the queues Slice 3
 * built. What UI-A changes is only the presentation — the page now uses the
 * shared `PageHeader` and `Card` instead of restating their classes — so that
 * UI-D adds widgets to a shell rather than replacing hand-written markup.
 */
export default async function StaffHomePage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff workspace"
        {...(active
          ? {
              description: (
                <>
                  You are working in <span className="font-medium">{active.barangayName}</span> as{' '}
                  {active.roles.length > 0 ? active.roles.join(', ') : 'a member'}.
                </>
              ),
            }
          : {})}
      />

      {active ? (
        <Card>
          <p className="text-dense text-neutral-500">
            Queues, requests and reports arrive with their slices. Member administration and the
            audit log are available from the navigation above.
          </p>
        </Card>
      ) : (
        <Alert tone="warning" title="No active barangay membership" live="none">
          No active barangay membership was found. Contact your barangay administrator to be added
          before using the staff workspace.
        </Alert>
      )}
    </div>
  )
}
