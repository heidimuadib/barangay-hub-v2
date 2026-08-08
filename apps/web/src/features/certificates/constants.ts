/**
 * Slice 4 capability keys, exactly as seeded by migration 20260809010000.
 * The database rows are authoritative; these constants keep application code
 * typo-proof.
 */
export const CERTIFICATE_PERMISSIONS = {
  read: 'certificates.read',
  issue: 'certificates.issue',
  void: 'certificates.void',
  manageTemplates: 'certificates.manage_templates',
  manageSeries: 'certificates.manage_series',
  artifactRead: 'certificates.artifact.read',
} as const

export type CertificatePermissionKey =
  (typeof CERTIFICATE_PERMISSIONS)[keyof typeof CERTIFICATE_PERMISSIONS]

/**
 * The serial FORMAT is unconfirmed (roadmap Slice 4 §8 — owner sign-off within
 * the slice). Until it resolves, every serial rendered anywhere carries this
 * marking, so nobody quotes a synthetic number as an official one.
 *
 * Deliberately distinct wording from B-08's fee notice: a reader who sees the
 * same phrase on a fee and on a serial learns nothing about which decision is
 * outstanding.
 */
export const SERIAL_PLACEHOLDER_NOTICE = 'Format not yet confirmed'

export const SERIAL_PLACEHOLDER_EXPLANATION =
  'This barangay has not confirmed how its certificate serials are written. ' +
  'The number itself is real and accounted for — only its printed form may change.'

/**
 * Certificate WORDING and SIGNATORIES are unconfirmed (B-05/-06/-07). A
 * template carrying this must never be presented as approved legal text.
 */
export const TEMPLATE_PLACEHOLDER_NOTICE = 'Wording not yet approved'

export const TEMPLATE_PLACEHOLDER_EXPLANATION =
  'The wording and signatory block of this certificate have not been approved ' +
  'by the barangay. Do not issue it to a resident outside testing.'

/** The register entries these are blocked on. */
export const CERTIFICATE_BLOCKERS = 'B-05 / B-06 / B-07'
