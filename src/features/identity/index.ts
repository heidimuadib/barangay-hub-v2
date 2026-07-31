/**
 * Identity feature — public surface.
 *
 * Authentication, the authorization context, guards, and the minimal account
 * components. Other features and the app layer import ONLY from here
 * (Phase 6 §16.2).
 */
export { ACTIVE_BARANGAY_COOKIE, PERMISSIONS, STAFF_CAPABILITIES } from './constants'

export type { AuthorizationContext, MembershipContext, MembershipStatus } from './types/context'

export {
  activeMembership,
  can,
  getAuthorizationContext,
  hasStaffCapability,
  landingRouteFor,
  requireAuthenticatedUser,
  requireMembership,
  requirePermission,
  requirePlatformPermission,
  resolveActiveBarangay,
} from './services/authorization'

export { signInAction } from './actions/sign-in'
export { signOutAction } from './actions/sign-out'
export { setActiveBarangayAction } from './actions/set-active-barangay'
export { updateProfileAction } from './actions/update-profile'

export { SignInForm } from './components/sign-in-form'
export { SignOutButton } from './components/sign-out-button'
export { BarangaySwitcher } from './components/barangay-switcher'
export { ProfileForm } from './components/profile-form'
