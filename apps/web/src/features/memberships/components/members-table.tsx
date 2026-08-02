import type { BarangayRoleOption, RosterMember } from '../types/roster'
import { MemberRowControls } from './member-row-controls'

const STATUS_STYLES: Record<RosterMember['status'], string> = {
  active: 'bg-success-100 text-success-700',
  invited: 'bg-info-100 text-info-700',
  disabled: 'bg-danger-100 text-danger-700',
}

export function MembersTable({
  barangayId,
  members,
  roleOptions,
  canManage,
  canAssign,
}: {
  barangayId: string
  members: readonly RosterMember[]
  roleOptions: readonly BarangayRoleOption[]
  canManage: boolean
  canAssign: boolean
}) {
  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700">
        No members yet. {canManage ? 'Invite the first member above.' : ''}
      </p>
    )
  }

  const showControls = canManage || canAssign

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="text-dense w-full text-left">
        <caption className="sr-only-focusable">Barangay members and their roles</caption>
        <thead>
          <tr className="border-b border-neutral-200 text-sm text-neutral-500">
            <th scope="col" className="px-4 py-3 font-medium">
              Member
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Roles
            </th>
            {showControls ? (
              <th scope="col" className="px-4 py-3 font-medium">
                Manage
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.membershipId} className="border-b border-neutral-100 align-top">
              <td className="px-4 py-3 font-medium text-neutral-900">{member.displayName}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-sm ${STATUS_STYLES[member.status]}`}
                >
                  {member.status}
                </span>
              </td>
              <td className="px-4 py-3 text-neutral-700">
                {member.roles.length > 0 ? member.roles.join(', ') : '—'}
              </td>
              {showControls ? (
                <td className="px-4 py-3">
                  <MemberRowControls
                    barangayId={barangayId}
                    member={member}
                    roleOptions={roleOptions}
                    canManage={canManage}
                    canAssign={canAssign}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
