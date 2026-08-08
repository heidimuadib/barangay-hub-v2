import type {
  CertificateActionKey,
  CertificateActorCapabilities,
  CertificateStatus,
  TemplateStanding,
} from '../types/certificates'

/**
 * Issuance eligibility and certificate lifecycle rules (Slice 4A).
 *
 * Every rule here is enforced again by `issue_certificate` and
 * `void_certificate`, which re-check capability and state inside the database
 * and fail closed. These mirrors exist so a screen can refuse early with an
 * explanation, and so the reasoning is testable in isolation.
 */

/**
 * Why a request cannot be issued yet.
 *
 * Returned as a reason rather than a boolean because the answers need
 * different next actions: a request still in review needs a reviewer, a
 * barangay with no serial book needs an administrator, and a missing template
 * needs one authored. Collapsing them into `false` is how a staff member ends
 * up at a disabled button with no idea what to do.
 */
export type IssuanceBlock =
  | 'not_ready'
  | 'already_issued'
  | 'no_template'
  | 'no_series'
  | 'template_type_mismatch'
  | 'not_permitted'

export interface IssuanceContext {
  /** The Slice 3 request state, as a plain string from the request row. */
  readonly requestState: string
  /** An ACTIVE certificate already exists for this request. */
  readonly hasActiveCertificate: boolean
  readonly templateId: string | null
  /** The document type the chosen template renders, if a template was chosen. */
  readonly templateDocumentTypeId: string | null
  readonly requestDocumentTypeId: string
  readonly hasActiveSeries: boolean
  readonly canIssue: boolean
}

/**
 * The single reason issuance is blocked, or null when it may proceed.
 *
 * Ordered deliberately: capability first, because a caller who may not issue
 * should learn nothing about the request's readiness or the barangay's series
 * configuration (Phase 4 §13.6).
 */
export function issuanceBlock(context: IssuanceContext): IssuanceBlock | null {
  if (!context.canIssue) return 'not_permitted'
  if (context.requestState !== 'ready_for_issue') return 'not_ready'
  if (context.hasActiveCertificate) return 'already_issued'
  if (context.templateId === null) return 'no_template'
  if (context.templateDocumentTypeId !== context.requestDocumentTypeId) {
    return 'template_type_mismatch'
  }
  if (!context.hasActiveSeries) return 'no_series'
  return null
}

export function canIssue(context: IssuanceContext): boolean {
  return issuanceBlock(context) === null
}

/**
 * The certificate lifecycle, mirroring `certificates_guard`.
 *
 * One edge, and no way back. Reinstating a withdrawn certificate would leave
 * the serial book unable to say which numbers are live, so a correction is a
 * NEW certificate with a NEW serial rather than an edit to an old one.
 */
export const CERTIFICATE_TRANSITIONS: Readonly<
  Record<CertificateStatus, readonly CertificateStatus[]>
> = {
  issued: ['voided'],
  voided: [],
}

export function canTransition(from: CertificateStatus, to: CertificateStatus): boolean {
  return CERTIFICATE_TRANSITIONS[from].includes(to)
}

/** A voided certificate is final; only an issued one can still be acted on. */
export function isActive(status: CertificateStatus): boolean {
  return status === 'issued'
}

/**
 * Which controls a staff surface may offer, derived FROM the transition map
 * and the caller's capabilities — not a second hand-written list — so the UI
 * can never advertise an act the database would refuse.
 */
export function availableCertificateActions(
  status: CertificateStatus,
  capabilities: CertificateActorCapabilities,
): readonly CertificateActionKey[] {
  const actions: CertificateActionKey[] = []
  if (canTransition(status, 'voided') && capabilities.canVoid) {
    actions.push('void')
  }
  // A voided certificate's artifact stays downloadable for the record: the
  // document existed, and withdrawing it does not unmake the history.
  if (capabilities.canReadArtifact) {
    actions.push('download')
  }
  return actions
}

/**
 * Whether a template is safe to put in front of a resident.
 *
 * B-05/-06/-07 are unresolved, so today this returns false for every seeded
 * template — which is correct and is the point. The branch for `true` exists
 * so confirming the wording needs no code change.
 */
export function templateIsApproved(standing: TemplateStanding): boolean {
  return !standing.contentIsPlaceholder && standing.hasSignatory
}

/**
 * What a surface must warn about before issuing from this template.
 *
 * Returns every applicable warning rather than the first: a template can be
 * both unapproved AND missing a signatory, and fixing one while the other
 * stays hidden is how a half-finished document reaches a resident.
 */
export function templateWarnings(standing: TemplateStanding): readonly string[] {
  const warnings: string[] = []
  if (standing.contentIsPlaceholder) warnings.push('wording_unapproved')
  if (!standing.hasSignatory) warnings.push('signatory_unconfirmed')
  if (standing.requiresWetSignature) warnings.push('requires_wet_signature')
  return warnings
}
