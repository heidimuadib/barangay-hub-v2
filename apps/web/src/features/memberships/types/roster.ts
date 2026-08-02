// Self-contained: feature type modules import nothing (boundaries default-deny).
export type RosterMembershipStatus = 'invited' | 'active' | 'disabled'

export interface RosterMember {
  readonly membershipId: string
  readonly userId: string
  readonly displayName: string
  readonly status: RosterMembershipStatus
  readonly roles: readonly string[]
}

export interface BarangayRoleOption {
  readonly key: string
  readonly name: string
}
