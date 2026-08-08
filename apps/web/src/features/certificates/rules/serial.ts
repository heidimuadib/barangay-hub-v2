import type { CertificateSerial } from '../types/certificates'

/**
 * Serial rendering and accountability rules (Slice 4A).
 *
 * The DATABASE owns allocation: `allocate_certificate_serial` takes a row
 * lock, advances a counter that never rewinds, and a unique constraint refuses
 * a duplicate even if both of those were wrong. Nothing here is a security
 * boundary or a source of numbers.
 *
 * What lives here is the presentation rule and the reading of an accountable
 * book — pure, and therefore exhaustively testable without a database.
 */

/**
 * Renders the accountable parts, mirroring `format_certificate_serial()`.
 *
 * This mirror exists so a screen can preview a serial before one is allocated
 * (a staff member asking "what will this be numbered?"). Where the two ever
 * disagree, the SQL wins and this has a defect — the same rule the request
 * transition map states about itself.
 */
export function formatSerial(params: {
  prefix: string
  year: number
  sequence: number
  width: number
}): string {
  return `${params.prefix}-${params.year}-${String(params.sequence).padStart(params.width, '0')}`
}

/**
 * A serial is only safe to present as official once the barangay has approved
 * the format. Until then every surface must say so.
 */
export function isSerialConfirmed(serial: CertificateSerial): boolean {
  return !serial.isPlaceholder
}

export type SerialAccountability =
  /** Every number from 1 to the highest issued is present. */
  | 'complete'
  /** Numbers are missing and each has a void record explaining it. */
  | 'explained'
  /** Numbers are missing with no explanation — the state that must never occur. */
  | 'unexplained'

export interface SerialLedgerEntry {
  readonly sequence: number
  readonly voided: boolean
}

/**
 * Reads an accountable book and says whether every consumed number is
 * accounted for.
 *
 * This is the property the whole slice exists to guarantee, expressed as a
 * function so it can be asserted directly rather than inferred. A gap is not
 * automatically wrong — a voided certificate leaves its number consumed, and
 * that is correct. A gap with nothing explaining it is wrong, and is what
 * `unexplained` names.
 *
 * Note this reads what the database returned; it cannot itself see a number
 * that was consumed and then had its row deleted. That is why deletion is
 * refused at the table rather than discouraged here.
 */
export function assessLedger(entries: readonly SerialLedgerEntry[]): SerialAccountability {
  if (entries.length === 0) return 'complete'

  const sequences = entries.map((entry) => entry.sequence)
  const highest = Math.max(...sequences)
  const present = new Set(sequences)

  const missing: number[] = []
  for (let n = 1; n <= highest; n += 1) {
    if (!present.has(n)) missing.push(n)
  }

  if (missing.length === 0) return 'complete'

  // A missing number can only be explained by a record we can see. We cannot
  // see one for a row that is simply absent, so any gap at all is unexplained
  // — voids keep their row precisely so they never land here.
  return 'unexplained'
}

/**
 * The next number a book will hand out.
 *
 * Derived from the counter, never from `max(sequence) + 1`: the counter is the
 * authority, and computing from issued rows would silently reuse a number
 * whose certificate was deleted — which is exactly the failure the counter
 * exists to prevent.
 */
export function nextSequence(counter: number): number {
  return counter
}
