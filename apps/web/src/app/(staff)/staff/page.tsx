import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { Alert, Icon, PageHeader } from '@/components/ui'
import {
  ACTIVE_BARANGAY_COOKIE,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import { formatRoleList } from '@/utils/format'
import { staffNavSections } from '../staff-navigation'

export const metadata: Metadata = {
  title: 'Staff workspace',
  robots: { index: false, follow: false },
}

/**
 * Staff home (UI-B).
 *
 * The placeholder this replaces said "Queues, requests and reports arrive with
 * their slices" and pointed at "the navigation above". Both statements stopped
 * being true — the queues shipped in Slices 2 and 3, and the navigation is now
 * beside the page, not above it.
 *
 * What this is NOT is a dashboard. The legacy `admindash.php` opened with a row
 * of counts — pending complaints, today's requests, total residents — and every
 * one of them would need a new aggregate query behind a new domain service.
 * That is UI-D's work with the queue services it will have, and inventing the
 * numbers here, or reaching around the presentation boundary to compute them,
 * would be worse than not showing them. A landing page that routes people
 * correctly is honest; a dashboard of fabricated metrics is not.
 *
 * So it renders the modules the sidebar already resolved — same
 * `staffNavSections`, same `can()` results — as cards with room to explain
 * themselves. Zero new queries: the only data read is the authorization context
 * the layout already loaded.
 */
export default async function StaffHomePage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)

  // The workspace root and the personal dashboard are navigation, not modules —
  // a card linking to the page you are already on is furniture.
  const modules = staffNavSections(context, active)
    .filter((section) => section.title !== 'Workspace' && section.title !== 'Personal')
    .filter((section) => section.items.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff workspace"
        {...(active
          ? {
              description: (
                <>
                  You are working in <span className="font-medium">{active.barangayName}</span> as{' '}
                  {active.roles.length > 0 ? formatRoleList(active.roles) : 'a member'}.
                </>
              ),
            }
          : {})}
      />

      {active === null ? (
        <Alert tone="warning" title="No active barangay membership" live="none">
          No active barangay membership was found. Contact your barangay administrator to be added
          before using the staff workspace.
        </Alert>
      ) : modules.length === 0 ? (
        <Alert tone="info" title="No modules assigned yet" live="none">
          Your membership in {active.barangayName} is active, but it does not yet carry permission
          for any staff module. Your barangay administrator can grant these from the members page.
        </Alert>
      ) : (
        modules.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-eyebrow text-neutral-500 uppercase">{section.title}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <li key={item.href} className="flex">
                  <Link
                    href={item.href}
                    className="group rounded-surface hover:border-brand-600 hover:bg-brand-50 flex w-full flex-col gap-2 border border-neutral-200 bg-white p-5 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="rounded-surface bg-brand-100 text-brand-700 inline-flex size-10 shrink-0 items-center justify-center">
                        <Icon name={item.icon} />
                      </span>
                      <span className="text-brand-700 font-semibold group-hover:underline">
                        {item.label}
                      </span>
                    </span>
                    {item.description === undefined ? null : (
                      <span className="text-dense text-neutral-700">{item.description}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
