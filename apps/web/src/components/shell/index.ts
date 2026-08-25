/**
 * The application shells (UI-B).
 *
 * Four audiences, one shell. `AppShell` renders the three authenticated
 * contexts — staff, resident, platform — separated only by a `tone` and the
 * navigation the layout hands it; `PublicShell` is its own thing because the
 * portal must not resemble the console at all.
 *
 * The alternative was four layouts each owning its own sidebar, which is what
 * legacy did: `admindashboard/SIDEBAR/sidebar.php` and `dash/SIDEBAR/
 * sidebar.php` were the same file copied, and by the end they agreed on nothing
 * but the stylesheet. Anything genuinely per-audience is a prop.
 */

export { AccountArea, type AccountAreaProps } from './account-area'
export { AppShell, type AppShellProps } from './app-shell'
export { BrandLockup, type BrandLockupProps } from './brand-lockup'
export { MobileNav, type MobileNavProps } from './mobile-nav'
export { PublicShell, type PublicShellProps } from './public-shell'
export { SidebarNav, type SidebarNavProps, type SidebarTone } from './sidebar-nav'
export { compactSections, isCurrent, type NavItem, type NavSection } from './nav'
