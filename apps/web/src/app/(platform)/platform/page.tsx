import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuditTable, listPlatformAuditEvents } from '@/features/audit-trail'
import { getAuthorizationContext } from '@/features/identity'
import { listPlatformAssignments, listTenants } from '@/features/platform'

export const metadata: Metadata = {
  title: 'Platform console',
  robots: { index: false, follow: false },
}

/**
 * Slice 1 platform console: tenant METADATA, platform role assignments and
 * the platform-scope audit trail — all read-only. Tenant provisioning and
 * support grants arrive in Slice 9 / US-PLT-002. Tenant DATA is invisible
 * here by design (Phase 4 §16.4).
 */
export default async function PlatformHomePage() {
  // The layout carries the same check, but layout and page render
  // CONCURRENTLY — without this, an unauthorized page render can throw into
  // the error boundary before the layout's redirect settles.
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }
  if (!context.isPlatformAdmin) {
    redirect('/access-denied')
  }

  const [tenants, assignments, events] = await Promise.all([
    listTenants(),
    listPlatformAssignments(),
    listPlatformAuditEvents(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Platform console</h1>

      <section aria-labelledby="tenants-heading">
        <h2 id="tenants-heading" className="text-lg font-bold">
          Barangays
        </h2>
        {tenants.length === 0 ? (
          <p className="mt-2 rounded-lg border border-neutral-200 bg-white p-4 text-neutral-700">
            No barangays provisioned.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="text-dense w-full text-left">
              <caption className="sr-only-focusable">Provisioned barangays</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-sm text-neutral-500">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Code
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    State
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-neutral-100">
                    <td className="px-4 py-3 font-medium text-neutral-900">{tenant.name}</td>
                    <td className="tabular px-4 py-3 text-neutral-700">{tenant.code}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {tenant.is_active ? 'active' : 'inactive'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-sm text-neutral-500">
          Tenant metadata only. Barangay records, members and documents are never visible from the
          platform console.
        </p>
      </section>

      <section aria-labelledby="operators-heading">
        <h2 id="operators-heading" className="text-lg font-bold">
          Platform operators
        </h2>
        <ul className="mt-2 flex flex-col gap-2">
          {assignments.map((assignment) => (
            <li
              key={`${assignment.user_id}-${assignment.role_key}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-4 py-3"
            >
              <span className="tabular text-sm text-neutral-700">{assignment.user_id}</span>
              <span className="text-sm font-medium text-neutral-900">{assignment.role_key}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="platform-audit-heading">
        <h2 id="platform-audit-heading" className="text-lg font-bold">
          Platform audit trail
        </h2>
        <div className="mt-2">
          <AuditTable events={events} />
        </div>
      </section>
    </div>
  )
}
