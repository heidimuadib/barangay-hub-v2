// Self-contained: feature type modules import nothing (boundaries default-deny).

export type ResidencyBasisKey =
  'property_owner' | 'renter' | 'household_member' | 'caretaker' | 'informal_resident' | 'other'

export type PersonSource = 'self' | 'staff'

export type VerificationState =
  'draft' | 'submitted' | 'in_review' | 'info_requested' | 'resubmitted' | 'approved' | 'rejected'

export type EvidenceKind = 'identity' | 'residency' | 'supporting'

export interface DuplicateCandidate {
  readonly personId: string
  readonly firstName: string
  readonly lastName: string
  readonly birthdate: string | null
  readonly nameSimilarity: number
  readonly sameBirthdate: boolean
  readonly hasAccount: boolean
}

export interface PersonSearchHit {
  readonly personId: string
  readonly firstName: string
  readonly middleName: string | null
  readonly lastName: string
  readonly birthdate: string | null
  readonly residencyBasisKey: ResidencyBasisKey
  readonly sourceChannel: PersonSource
  readonly superseded: boolean
  readonly hasAccount: boolean
  readonly rank: number
}
