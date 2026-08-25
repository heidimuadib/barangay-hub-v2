import { describe, expect, it } from 'vitest'

import { compactSections, isCurrent, type NavItem, type NavSection } from '@/components/shell'

/**
 * UI-B — the current-route rule.
 *
 * Tested as a function rather than through a rendered sidebar, because this is
 * where the rule is easy to get subtly wrong and hard to see: the difference
 * between a prefix match and an exact one is invisible until a detail route
 * lights the wrong item, or the workspace root lights on every page.
 */

const item = (over: Partial<NavItem> = {}): NavItem => ({
  href: '/staff/registry',
  label: 'Registry',
  icon: 'id-card',
  ...over,
})

describe('isCurrent', () => {
  it('marks the item current on its own route', () => {
    expect(isCurrent(item(), '/staff/registry')).toBe(true)
  })

  it('keeps the parent current on a detail route', () => {
    // A person record is inside Registry. Losing the highlight there is how a
    // user stops knowing which module they are in.
    expect(isCurrent(item(), '/staff/registry/c0000000-0000-4000-8000-000000000004')).toBe(true)
    expect(isCurrent(item(), '/staff/registry/new')).toBe(true)
  })

  it('does not match a sibling that merely shares the prefix string', () => {
    // The boundary check: without the trailing slash, `/staff/registry` would
    // also light for `/staff/registry-archive`.
    expect(isCurrent(item(), '/staff/registry-archive')).toBe(false)
  })

  it('does not match an unrelated route', () => {
    expect(isCurrent(item(), '/staff/requests')).toBe(false)
  })

  describe('exact', () => {
    const root = item({ href: '/staff', label: 'Dashboard', icon: 'home', exact: true })

    it('matches only the route itself', () => {
      expect(isCurrent(root, '/staff')).toBe(true)
    })

    it('does not match descendants', () => {
      // Without `exact`, the workspace root would be current on every single
      // staff page and the highlight would mean nothing.
      expect(isCurrent(root, '/staff/registry')).toBe(false)
      expect(isCurrent(root, '/staff/requests/abc')).toBe(false)
    })
  })
})

describe('compactSections', () => {
  it('drops sections whose items were all filtered away by capability', () => {
    const sections: NavSection[] = [
      { title: 'Residents', items: [item()] },
      { title: 'Administration', items: [] },
    ]

    expect(compactSections(sections).map((section) => section.title)).toEqual(['Residents'])
  })

  it('keeps every populated section, in order', () => {
    const sections: NavSection[] = [
      { title: 'Workspace', items: [item({ href: '/staff' })] },
      { title: 'Residents', items: [item()] },
    ]

    expect(compactSections(sections)).toHaveLength(2)
  })
})
