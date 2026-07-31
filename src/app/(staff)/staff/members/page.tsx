import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ACTIVE_BARANGAY_COOKIE,
  PERMISSIONS,
  can,
  getAuthorizationContext,
  resolveActiveBarangay,
} from '@/features/identity'
import {
  InviteForm,
  MembersTable,
  listBarangayRoleOptions,
  listRoster,
} from '@/features/memberships'

export const metadata: Metadata = {
  title: 'Members',
  robots: { index: false, follow: false },
}

/**
 * Member roster and role administration (the minimal Slice 1 admin surface).
 * The page-level gate mirrors — never replaces — the service-layer
 * requirePermission and the RLS policies underneath.
 */
export default async function MembersPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const cookieStore = await cookies()
  const active = resolveActiveBarangay(context, cookieStore.get(ACTIVE_BARANGAY_COOKIE)?.value)
  if (!active || !can(context, active.barangayId, PERMISSIONS.membershipRead)) {
    redirect('/access-denied')
  }

  const canManage = can(context, active.barangayId, PERMISSIONS.membershipManage)
  const canAssign = can(context, active.barangayId, PERMISSIONS.roleAssign)

  const [members, roleOptions] = await Promise.all([
    listRoster(active.barangayId),
    listBarangayRoleOptions(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Members — {active.barangayName}</h1>
      {canManage ? <InviteForm barangayId={active.barangayId} /> : null}
      <MembersTable
        barangayId={active.barangayId}
        members={members}
        roleOptions={roleOptions}
        canManage={canManage}
        canAssign={canAssign}
      />
    </div>
  )
}
