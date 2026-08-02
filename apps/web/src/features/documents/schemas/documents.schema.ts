import { z } from 'zod'

import type { RequirementInputKind } from '../types/documents'

/**
 * Input validation for the Slice 3 domain surface.
 *
 * These schemas are the FIRST gate, never the only one: every rule here is
 * also enforced by a CHECK constraint or a trigger in migrations
 * 20260806010000/20260806040000, because a client-side parse protects nobody.
 * Their job is to fail early with a message a person can act on.
 */

/** Matches the `code` CHECK on document_types. */
export const documentTypeCodeSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z][a-z0-9-]{1,48}[a-z0-9]$/,
    'Use lower-case letters, numbers and hyphens (for example: barangay-clearance).',
  )

/** Matches the `key` CHECK on document_type_requirements. */
export const requirementKeySchema = z
  .string()
  .trim()
  .regex(
    /^[a-z][a-z0-9_]{1,48}[a-z0-9]$/,
    'Use lower-case letters, numbers and underscores (for example: years_of_residency).',
  )

export const purposeSchema = z
  .string()
  .trim()
  .min(1, 'Say what the document is for.')
  .max(500, 'Keep the purpose under 500 characters.')

export const createOwnRequestSchema = z.object({
  barangayId: z.string().uuid(),
  documentTypeId: z.string().uuid(),
  purpose: purposeSchema,
})

export type CreateOwnRequestInput = z.infer<typeof createOwnRequestSchema>

export const createWalkInRequestSchema = createOwnRequestSchema.extend({
  personId: z.string().uuid(),
  // The assisted channel must say why a record was created for someone else —
  // the trigger refuses a blank one (CREATION_REASON_REQUIRED).
  reason: z
    .string()
    .trim()
    .min(1, 'Record why this request is being filed at the counter.')
    .max(500, 'Keep the reason under 500 characters.'),
})

export type CreateWalkInRequestInput = z.infer<typeof createWalkInRequestSchema>

/**
 * Validates one answer against its requirement's declared kind.
 *
 * Mirrors `document_request_answers_before_write`. Returned as a schema
 * factory rather than a single union so a form can validate field-by-field
 * with the right message instead of a generic "invalid answer".
 */
export function answerSchemaFor(
  kind: RequirementInputKind,
  options: readonly string[] = [],
): z.ZodType<string> {
  const base = z
    .string()
    .trim()
    .min(1, 'This answer is required.')
    .max(1000, 'Keep the answer under 1000 characters.')

  switch (kind) {
    case 'number':
      return base.regex(/^-?[0-9]+(\.[0-9]+)?$/, 'Enter a number.')
    case 'date':
      return base
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date as YYYY-MM-DD.')
        .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a real date.')
    case 'boolean':
      return base.refine(
        (value) => value.toLowerCase() === 'true' || value.toLowerCase() === 'false',
        'Choose yes or no.',
      )
    case 'select':
      return base.refine((value) => options.includes(value), 'Choose one of the listed options.')
    case 'text':
    case 'textarea':
      return base
  }
}

export const createDocumentTypeSchema = z.object({
  barangayId: z.string().uuid(),
  code: documentTypeCodeSchema,
  name: z.string().trim().min(1, 'Give the document a name.').max(120),
  description: z.string().trim().max(2000).optional(),
  // Optional and nullable on purpose: "no amount decided yet" is a real state
  // that must survive the form (B-08), and is NOT the same as zero.
  feeAmount: z.number().nonnegative().nullable().optional(),
  slaDays: z.number().int().min(0).max(365).nullable().optional(),
  validityDays: z.number().int().min(1).max(3650).nullable().optional(),
  requiresSupportingEvidence: z.boolean().default(false),
})

export type CreateDocumentTypeInput = z.infer<typeof createDocumentTypeSchema>
