import { setActiveBarangayAction } from '../actions/set-active-barangay'
import type { MembershipContext } from '../types/context'

/**
 * Shown only to users with more than one ACTIVE membership. The selection is
 * validated server-side against live memberships; this control merely offers
 * the caller's own options.
 */
export function BarangaySwitcher({
  memberships,
  activeBarangayId,
}: {
  memberships: readonly MembershipContext[]
  activeBarangayId: string
}) {
  const active = memberships.filter((membership) => membership.status === 'active')
  if (active.length < 2) return null

  return (
    <form action={setActiveBarangayAction} className="flex items-center gap-2">
      <label htmlFor="barangay-switcher" className="text-sm text-neutral-700">
        Barangay
      </label>
      <select
        id="barangay-switcher"
        name="barangayId"
        defaultValue={activeBarangayId}
        className="min-h-11 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
      >
        {active.map((membership) => (
          <option key={membership.barangayId} value={membership.barangayId}>
            {membership.barangayName}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm font-medium hover:bg-neutral-100"
      >
        Switch
      </button>
    </form>
  )
}
