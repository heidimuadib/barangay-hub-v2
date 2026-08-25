import { describe, expect, it } from 'vitest'

import { staffNavSections } from '@/app/(staff)/staff-navigation'
import type { AuthorizationContext, MembershipContext } from '@/features/identity'

/**
 * UI-B — capability-aware staff navigation.
 *
 * The single most important behaviour in this subpart, and the one a visual
 * review cannot check: a clerk must not be offered a module they will be bounced
 * out of. It is not a security boundary — the route, the action chain and RLS
 * each refuse independently — but offering a link that leads to
 * `/access-denied` is a defect all the same.
 *
 * Everything is asserted against the ACTIVE barangay, because permissions are
 * per-membership. Somebody who is a captain in one barangay and a clerk in
 * another must see the clerk's sidebar while the clerk's barangay is switched
 * on, not the union of the two.
 */

const BARANGAY_A = '11111111-1111-4111-8111-111111111111'
const BARANGAY_B = '22222222-2222-4222-8222-222222222222'

function membership(over: Partial<MembershipContext> = {}): MembershipContext {
  return {
    membershipId: 'm-1',
    barangayId: BARANGAY_A,
    barangayCode: 'A',
    barangayName: 'San Isidro',
    status: 'active',
    roles: ['barangay_clerk'],
    permissions: [],
    ...over,
  }
}

function context(memberships: MembershipContext[]): AuthorizationContext {
  return {
    userId: 'u-1',
    displayName: 'Ana Reyes',
    isPlatformAdmin: false,
    platformPermissions: [],
    memberships,
  }
}

/** Every label the sidebar would show, flattened across its sections. */
function labels(sections: ReturnType<typeof staffNavSections>): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.label))
}

describe('staffNavSections', () => {
  it('offers only the modules the active membership holds permission for', () => {
    const active = membership({ permissions: ['registry.read'] })

    expect(labels(staffNavSections(context([active]), active))).toEqual([
      'Dashboard',
      'Registry',
      'My dashboard',
    ])
  })

  it('offers every module to a fully-permitted administrator', () => {
    const active = membership({
      roles: ['barangay_administrator'],
      permissions: [
        'registry.read',
        'verification.read',
        'requests.read',
        'membership.read',
        'audit.read',
      ],
    })

    expect(labels(staffNavSections(context([active]), active))).toEqual([
      'Dashboard',
      'Registry',
      'Verification',
      'Requests',
      'Members',
      'Audit log',
      'My dashboard',
    ])
  })

  it('withholds the audit log from someone without audit.read', () => {
    const active = membership({ permissions: ['registry.read', 'membership.read'] })

    expect(labels(staffNavSections(context([active]), active))).not.toContain('Audit log')
  })

  it('empties a section rather than showing a heading with nothing under it', () => {
    const active = membership({ permissions: ['registry.read'] })
    const sections = staffNavSections(context([active]), active)

    const administration = sections.find((section) => section.title === 'Administration')
    expect(administration?.items).toEqual([])
  })

  it('scopes permissions to the active barangay, not to the union of memberships', () => {
    // A captain in B and a clerk in A, working in A: the sidebar is the clerk's.
    const clerkInA = membership({ permissions: ['registry.read'] })
    const captainInB = membership({
      membershipId: 'm-2',
      barangayId: BARANGAY_B,
      barangayCode: 'B',
      barangayName: 'Malinis',
      roles: ['barangay_administrator'],
      permissions: ['registry.read', 'audit.read', 'membership.read'],
    })

    const shown = labels(staffNavSections(context([clerkInA, captainInB]), clerkInA))

    expect(shown).toContain('Registry')
    expect(shown).not.toContain('Audit log')
    expect(shown).not.toContain('Members')
  })

  it('offers no module at all when no barangay is active', () => {
    // Nothing to scope a permission to. The workspace root stays, because it is
    // the page that explains the situation.
    const shown = labels(staffNavSections(context([membership()]), null))

    expect(shown).toEqual(['Dashboard', 'My dashboard'])
  })

  it('never offers certificates — Slice 4 is paused and not on this branch', () => {
    const active = membership({
      permissions: [
        'registry.read',
        'verification.read',
        'requests.read',
        'membership.read',
        'audit.read',
        // Even if a membership somehow carried it, UI-B must not surface it.
        'certificates.read',
      ],
    })

    const shown = labels(staffNavSections(context([active]), active))
    expect(shown.some((label) => /certificate/i.test(label))).toBe(false)
  })

  it('marks the section roots exact so they do not light on every page', () => {
    const active = membership({ permissions: ['registry.read'] })
    const items = staffNavSections(context([active]), active).flatMap((section) => section.items)

    expect(items.find((item) => item.href === '/staff')?.exact).toBe(true)
    expect(items.find((item) => item.href === '/dashboard')?.exact).toBe(true)
    // A module root is a prefix match — its detail routes keep it current.
    expect(items.find((item) => item.href === '/staff/registry')?.exact).toBeUndefined()
  })

  it('gives every offered module a description for the landing cards', () => {
    const active = membership({
      permissions: ['registry.read', 'verification.read', 'requests.read'],
    })
    const items = staffNavSections(context([active]), active).flatMap((section) => section.items)

    for (const item of items) {
      expect(item.description, `${item.label} has no description`).toBeTruthy()
    }
  })
})
