import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { AuditTable, listTenantAuditEvents } from '@/features/audit-trail'
import {
  ACTIVE_BARANGAY_COOKIE,
  PERMISSIONS,
  can,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'

export const metadata: Metadata = {
  title: 'Audit log',
  robots: { index: false, follow: false },
}

export default async function AuditLogPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, PERMISSIONS.auditRead)) {
    redirect('/access-denied')
  }

  const events = await listTenantAuditEvents(active.barangayId)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Audit log — {active.barangayName}</h1>
      <p className="text-sm text-neutral-500">
        The most recent {events.length} events. Audit records are append-only; nobody, including
        administrators, can edit or delete them.
      </p>
      <AuditTable events={events} />
    </div>
  )
}
