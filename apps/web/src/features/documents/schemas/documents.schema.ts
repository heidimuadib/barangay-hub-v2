import { z } from 'zod'

import { ANSWER_FIELD_PREFIX } from '../constants'
import type { RequirementField, RequirementInputKind } from '../types/documents'

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

/**
 * Identifies one request for the lifecycle actions (Slice 3B).
 *
 * The barangay travels with the id so the action can scope its ownership check
 * to one tenant rather than searching for the request across all of them.
 */
export const requestActionSchema = z.object({
  requestId: z.string().uuid(),
  barangayId: z.string().uuid(),
})

export type RequestActionInput = z.infer<typeof requestActionSchema>

/**
 * The form field name carrying one requirement's answer.
 *
 * Prefixed because requirement keys are barangay-authored: a type could
 * legitimately define a requirement called `purpose`, which would otherwise
 * overwrite the request's own purpose field in the same FormData.
 */
export function answerFieldName(key: string): string {
  return `${ANSWER_FIELD_PREFIX}${key}`
}

export interface AnswerValidation {
  /** Requirement id → trimmed value, for the requirements that were answered. */
  readonly answers: ReadonlyMap<string, string>
  /** Field-name → messages, ready to merge into a ValidationError. */
  readonly fieldErrors: Readonly<Record<string, string[]>>
}

/**
 * Validates a whole answer set against its type's requirements.
 *
 * Every rule applied here is applied again by `document_request_answers_before_write`
 * and by `submit_request`'s completeness gate — this runs first so a resident
 * gets every problem at once, against the right field, instead of one
 * round-trip per mistake.
 *
 * Optional-and-blank is a legitimate non-answer and is simply omitted: writing
 * an empty string would fail the column's own length CHECK.
 */
export function validateAnswers(
  requirements: readonly RequirementField[],
  values: Readonly<Record<string, string | undefined>>,
): AnswerValidation {
  const answers = new Map<string, string>()
  const fieldErrors: Record<string, string[]> = {}

  for (const requirement of requirements) {
    const raw = values[requirement.key]
    const trimmed = raw?.trim() ?? ''

    if (trimmed === '') {
      if (requirement.isRequired) {
        fieldErrors[answerFieldName(requirement.key)] = ['This answer is required.']
      }
      continue
    }

    const parsed = answerSchemaFor(requirement.inputKind, requirement.options).safeParse(trimmed)
    if (parsed.success) {
      answers.set(requirement.requirementId, parsed.data)
    } else {
      fieldErrors[answerFieldName(requirement.key)] = parsed.error.issues.map(
        (issue) => issue.message,
      )
    }
  }

  return { answers, fieldErrors }
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
