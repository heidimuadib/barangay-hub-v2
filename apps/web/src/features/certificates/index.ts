/**
 * Public barrel for the certificates feature (Slice 4A — domain foundation).
 *
 * Only rules, types and constants so far: 4A ships the domain and its proofs.
 * Template rendering and PDF artifacts arrive in 4B, the staff issuance and
 * void workflow in 4C, QR and public verification in 4D. Cross-feature
 * imports must come through this file (Phase 6 §16.2).
 */
export {
  CERTIFICATE_BLOCKERS,
  CERTIFICATE_PERMISSIONS,
  SERIAL_PLACEHOLDER_EXPLANATION,
  SERIAL_PLACEHOLDER_NOTICE,
  TEMPLATE_PLACEHOLDER_EXPLANATION,
  TEMPLATE_PLACEHOLDER_NOTICE,
} from './constants'
export type { CertificatePermissionKey } from './constants'

export type {
  CertificateActionKey,
  CertificateActorCapabilities,
  CertificateRow,
  CertificateSerial,
  CertificateSeriesRow,
  CertificateStatus,
  CertificateTemplateRow,
  TemplateStanding,
} from './types/certificates'

export {
  assessLedger,
  formatSerial,
  isSerialConfirmed,
  nextSequence,
  type SerialAccountability,
  type SerialLedgerEntry,
} from './rules/serial'

export {
  CERTIFICATE_TRANSITIONS,
  availableCertificateActions,
  canIssue,
  canTransition,
  isActive,
  issuanceBlock,
  templateIsApproved,
  templateWarnings,
  type IssuanceBlock,
  type IssuanceContext,
} from './rules/issuance'

export {
  VERIFICATION_TOKEN_ENTROPY_BITS,
  VERIFICATION_TOKEN_LENGTH,
  isValidVerificationToken,
  looksNonSequential,
  normalizeVerificationToken,
} from './rules/verification-token'
