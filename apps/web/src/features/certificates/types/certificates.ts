import type { Database } from '@barangay-hub/supabase/types'

/** Issued, or withdrawn. Straight from the database enum (Slice 4A). */
export type CertificateStatus = Database['public']['Enums']['certificate_status']

export type CertificateTemplateRow = Database['public']['Tables']['certificate_templates']['Row']
export type CertificateSeriesRow = Database['public']['Tables']['certificate_series']['Row']
export type CertificateRow = Database['public']['Tables']['certificates']['Row']

/**
 * The accountable parts of a serial, kept apart from its rendering.
 *
 * Modelled as its own type because these travel together and are misleading
 * apart: a display string without `isPlaceholder` is exactly the misreading
 * the unconfirmed-format decision exists to prevent — the same shape
 * `CatalogTerms` uses for B-08 fees.
 */
export interface CertificateSerial {
  readonly sequence: number
  readonly display: string
  /** True while the barangay has not approved a serial format. */
  readonly isPlaceholder: boolean
}

/** What a template promises, and how much of it is confirmed. */
export interface TemplateStanding {
  /** B-05: the wording itself is unapproved. */
  readonly contentIsPlaceholder: boolean
  /** B-06: a named signatory, or nobody yet. */
  readonly hasSignatory: boolean
  /** B-07: signed on paper, not digitally. */
  readonly requiresWetSignature: boolean
}

/** Controls a certificate surface may offer, resolved from capabilities. */
export interface CertificateActorCapabilities {
  readonly canIssue: boolean
  readonly canVoid: boolean
  readonly canReadArtifact: boolean
}

/** What the staff detail may offer for one certificate. */
export type CertificateActionKey = 'void' | 'download'
