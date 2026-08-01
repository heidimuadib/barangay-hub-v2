import { z } from 'zod'

import { isPlausibleBirthdate, normalizeContactPhone, normalizePersonName } from '@/utils/normalize'

import { EVIDENCE_MAX_BYTES, EVIDENCE_MIME_TYPES, RESIDENCY_BASES } from '../constants'

const RESIDENCY_KEYS = [
  'property_owner',
  'renter',
  'household_member',
  'caretaker',
  'informal_resident',
  'other',
] as const

// Names are normalised (trim + collapse internal whitespace) and nothing more
// — see the reasoning in @/utils/normalize.
const name = z.string().transform(normalizePersonName).pipe(z.string().min(1).max(100))
const optionalName = z.string().transform(normalizePersonName).pipe(z.string().max(100)).optional()

/**
 * Shared person payload for BOTH channels (ADR-0006 point 6): self-onboarding
 * and staff walk-in creation validate identically; only authorization and
 * provenance differ.
 */
export const personDetailsSchema = z
  .object({
    barangayId: z.string().uuid(),
    firstName: name,
    middleName: optionalName,
    lastName: name,
    suffix: z.string().trim().max(20).optional(),
    // Duplicate SIGNAL only, never identity proof (ADR-0006 point 9).
    birthdate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.')
      .refine((value) => isPlausibleBirthdate(value), 'Enter a real date in the past.')
      .optional(),
    contactPhone: z.string().transform(normalizeContactPhone).pipe(z.string().max(30)).optional(),
    addressLine: z.string().trim().max(200).optional(),
    residencyBasis: z.enum(RESIDENCY_KEYS),
    residencyExplanation: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    // D2-01: explanation required iff the basis demands it, forbidden
    // otherwise (mirrors the database trigger; the trigger is authoritative).
    const needed = RESIDENCY_BASES[value.residencyBasis].requiresExplanation
    const provided = (value.residencyExplanation ?? '').trim().length > 0
    if (needed !== provided) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['residencyExplanation'],
        message: needed
          ? 'Explain the residency arrangement (required for “Other”).'
          : 'An explanation applies only to the “Other” basis.',
      })
    }
  })

/** Staff walk-in creation additionally REQUIRES a reason (ADR-0006 point 7). */
export const walkInCreateSchema = z.object({
  details: personDetailsSchema,
  reason: z.string().trim().min(1, 'A reason is required for staff-assisted creation.').max(500),
})

export const evidenceMetadataSchema = z.object({
  applicationId: z.string().uuid(),
  kind: z.enum(['identity', 'residency', 'supporting']),
  mimeType: z.enum(EVIDENCE_MIME_TYPES),
  declaredSizeBytes: z
    .number()
    .int()
    .positive()
    .max(EVIDENCE_MAX_BYTES, 'Files are limited to 10 MiB.'),
})

export const supersedeSchema = z.object({
  loserPersonId: z.string().uuid(),
  survivorPersonId: z.string().uuid(),
  reason: z.string().trim().min(1, 'A reason is required.').max(500),
})

export const rejectSchema = z.object({
  applicationId: z.string().uuid(),
  reason: z.string().trim().min(1, 'A rejection reason is required.').max(1000),
})

export const requestInformationSchema = z.object({
  applicationId: z.string().uuid(),
  note: z.string().trim().min(1, 'Tell the resident what is missing.').max(1000),
})

/**
 * Registry search input. The term travels in a POST body and is never placed
 * in a URL, so this schema is the only place it is shaped (P6-C-E).
 */
export const registrySearchSchema = z.object({
  barangayId: z.string().uuid(),
  term: z.string().trim().min(2, 'Type at least two characters.').max(100),
})
