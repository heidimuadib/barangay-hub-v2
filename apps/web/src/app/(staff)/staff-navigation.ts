import type { NavSection } from '@/components/shell'
import {
  PERMISSIONS,
  can,
  type AuthorizationContext,
  type MembershipContext,
} from '@/features/identity'
import { DOCUMENT_PERMISSIONS } from '@/features/documents'
import { REGISTRY_PERMISSIONS } from '@/features/registry'

/**
 * The staff navigation, built once (UI-B).
 *
 * The sidebar and the workspace landing page show the same modules, gated on the
 * same permissions. Written twice they would drift — legacy proved that, with
 * `$navLinks` in `admin_init.php` and a second hand-written set of dashboard
 * tiles in `admindash.php` that had already fallen a module behind. So both
 * callers ask this.
 *
 * Every decision is a `can()` against the ACTIVE barangay. Permissions are
 * per-membership, so a clerk in one barangay and a captain in another sees a
 * different sidebar depending on which is switched on — not the union of the
 * two, which is what a user-level check would produce.
 *
 * This is presentation, not authorization. It decides what is OFFERED. The
 * route, the action chain and RLS each decide independently what is ALLOWED
 * (Phase 4 DB-ADR-03).
 */
export function staffNavSections(
  context: AuthorizationContext,
  active: MembershipContext | null,
): NavSection[] {
  // No active barangay means no tenant to scope a permission to. Every module
  // resolves to false and the sidebar keeps only the pages that explain why.
  const allowed = (permission: string) =>
    active !== null && can(context, active.barangayId, permission)

  return [
    {
      title: 'Workspace',
      items: [
        {
          href: '/staff',
          label: 'Dashboard',
          icon: 'home',
          exact: true,
          description: 'Where you are now — the modules this barangay has given you.',
        },
      ],
    },
    {
      title: 'Residents',
      items: [
        ...(allowed(REGISTRY_PERMISSIONS.registryRead)
          ? [
              {
                href: '/staff/registry',
                label: 'Registry',
                icon: 'id-card' as const,
                description: 'Search resident records and file walk-in registrations.',
              },
            ]
          : []),
        ...(allowed(REGISTRY_PERMISSIONS.verificationRead)
          ? [
              {
                href: '/staff/verification',
                label: 'Verification',
                icon: 'shield-check' as const,
                description: 'Review identity applications and approve resident accounts.',
              },
            ]
          : []),
      ],
    },
    {
      title: 'Documents',
      items: allowed(DOCUMENT_PERMISSIONS.requestsRead)
        ? [
            {
              href: '/staff/requests',
              label: 'Requests',
              icon: 'inbox' as const,
              description: 'Work the document request queue from intake through release.',
            },
          ]
        : [],
    },
    {
      title: 'Administration',
      items: [
        ...(allowed(PERMISSIONS.membershipRead)
          ? [
              {
                href: '/staff/members',
                label: 'Members',
                icon: 'users' as const,
                description: 'Manage who works in this barangay and what they may do.',
              },
            ]
          : []),
        ...(allowed(PERMISSIONS.auditRead)
          ? [
              {
                href: '/staff/audit',
                label: 'Audit log',
                icon: 'scroll-text' as const,
                description: 'Trace who did what, when, and to which record.',
              },
            ]
          : []),
      ],
    },
    {
      title: 'Personal',
      items: [
        {
          href: '/dashboard',
          label: 'My dashboard',
          icon: 'user',
          exact: true,
          description: 'Your own resident account, separate from your staff role.',
        },
      ],
    },
  ]
}
