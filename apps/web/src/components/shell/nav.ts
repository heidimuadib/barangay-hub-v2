import type { IconName } from '@/components/ui'

/**
 * The navigation contract between a layout and its shell (UI-B).
 *
 * Every shell decides what a person may see on the SERVER, in the layout, using
 * `can()` against the authorization context — and then hands the shell plain
 * data. The shell itself is a client component, because active state needs
 * `usePathname` and the mobile drawer needs state; if it also held the
 * capability logic, `can()` and the permission constants would cross into the
 * browser bundle and the navigation would become a client-side authorization
 * decision. It is not one, and it must not look like one.
 *
 * So these types are deliberately dumb: strings and an icon name. Whatever the
 * layout omits, the shell cannot render, and the check that omitted it stayed on
 * the server.
 *
 * Nothing here is a security boundary. A hidden nav item is a courtesy — the
 * route itself re-authorizes, the action chain re-authorizes, and RLS refuses
 * regardless (Phase 4 DB-ADR-03). What this prevents is the other failure: a
 * clerk shown "Audit log" who is then bounced to /access-denied for clicking it.
 */

export type NavItem = {
  href: string
  label: string
  icon: IconName
  /**
   * Matched as a prefix so a detail route lights its parent — `/staff/registry/
   * <personId>` keeps "Registry" current. `exact` opts out, which the section
   * roots need: without it `/staff` would be current on every staff page.
   */
  exact?: boolean
  /** Short gloss, shown on the staff landing cards rather than in the sidebar. */
  description?: string
}

export type NavSection = {
  /**
   * Rendered as the group heading, and used as the `aria-label` of the
   * enclosed list so a screen-reader user hears the grouping the sighted
   * legacy sidebar showed with its "Main Menu" eyebrow.
   */
  title: string
  items: NavItem[]
}

/**
 * True when `pathname` should mark `item` current.
 *
 * Exported because both the sidebar and the mobile drawer need it, and the unit
 * tests assert the prefix rule directly rather than through a rendered tree.
 */
export function isCurrent(item: NavItem, pathname: string): boolean {
  if (item.exact === true) {
    return pathname === item.href
  }
  // Guard the boundary: `/staff/requests` must not light up for
  // `/staff/requests-archive` should such a sibling ever exist.
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/** Drops empty sections so a shell never renders a heading with no links. */
export function compactSections(sections: NavSection[]): NavSection[] {
  return sections.filter((section) => section.items.length > 0)
}
