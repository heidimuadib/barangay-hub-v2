'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { requireAuthenticatedUser } from '@/features/identity'
import {
  NotFoundError,
  ok,
  resultFromError,
  toAppError,
  ValidationError,
  type Result,
} from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'

import { ANSWER_FIELD_PREFIX } from '../constants'
import { getDocumentTypeDetail } from '../services/catalog-service'
import {
  canRequestDocuments,
  documentsService,
  isEditable,
  throwDocumentFailure,
  unwrap,
} from '../services/documents-service'
import { getOwnRequestDetail, getResidentStanding } from '../services/request-service'
import {
  createOwnRequestSchema,
  requestActionSchema,
  validateAnswers,
} from '../schemas/documents.schema'
import type { RequirementField } from '../types/documents'

/**
 * Resident document requests (Slice 3B).
 *
 * Every action ends at a 3A domain function, and every rule these actions
 * apply is applied again inside the database. The duplication is the point:
 * a Server Action is a network endpoint, so it re-checks rather than trusting
 * the page that rendered the form, and the database re-checks rather than
 * trusting the action (Phase 3 ADR-01).
 *
 * The purpose and every answer are resident free text and therefore personal
 * data — they are never logged, never put in a URL, and never reach an audit
 * payload (the triggers record a COUNT of answers, not their content).
 */

export interface RequestActionData {
  readonly requestId: string
}

/**
 * Creates a DRAFT request and records its answers.
 *
 * Two steps rather than one transaction, because 3A's surface is two
 * functions. A failure between them leaves a draft whose answers are
 * incomplete — which is a legitimate, recoverable state: the draft is visible,
 * editable and cannot be submitted until it is complete, and `submit_request`
 * enforces that independently.
 */
export async function createRequestAction(
  _previous: Result<RequestActionData> | null,
  formData: FormData,
): Promise<Result<RequestActionData>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const context = await requireAuthenticatedUser()

    const parsed = createOwnRequestSchema.safeParse({
      barangayId: formData.get('barangayId'),
      documentTypeId: formData.get('documentTypeId'),
      purpose: formData.get('purpose'),
    })
    if (!parsed.success) {
      throw validationErrorFrom(parsed.error.issues)
    }
    const { barangayId, documentTypeId, purpose } = parsed.data

    // Membership and the active-type rule, from the service that owns them.
    // Withdrawn, cross-tenant and nonexistent are one refusal (Phase 4 §13.6).
    const detail = await getDocumentTypeDetail(barangayId, documentTypeId)
    if (!detail) {
      throwDocumentFailure('type-unavailable')
    }

    // The verification gate, refused here with the SAME error the database
    // raises, so the two cannot drift apart in wording or in code.
    const standing = await getResidentStanding(barangayId)
    if (!canRequestDocuments(standing)) {
      throwDocumentFailure('not-verified')
    }

    const { answers, fieldErrors } = validateAnswers(
      detail.requirements,
      readAnswers(formData, detail.requirements),
    )
    if (Object.keys(fieldErrors).length > 0) {
      throw new ValidationError('Check the highlighted answers and try again.', fieldErrors)
    }

    const requestId = unwrap(
      await documentsService.createOwnRequest({
        p_barangay_id: barangayId,
        p_document_type_id: documentTypeId,
        p_purpose: purpose,
      }),
      'create_own_request',
    )

    await writeAnswers(requestId, answers)

    logger.info('Document request draft created', {
      userId: context.userId,
      barangayId,
      requestId,
    })
    revalidatePath('/requests')
    revalidatePath('/dashboard')
    return ok({ requestId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

/** Records answers on an existing draft. Idempotent per requirement. */
export async function saveAnswersAction(
  _previous: Result<RequestActionData> | null,
  formData: FormData,
): Promise<Result<RequestActionData>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    await requireAuthenticatedUser()

    const parsed = requestActionSchema.safeParse({
      requestId: formData.get('requestId'),
      barangayId: formData.get('barangayId'),
    })
    if (!parsed.success) {
      throw validationErrorFrom(parsed.error.issues)
    }
    const { requestId, barangayId } = parsed.data

    // Ownership, tenant and existence in one call — another resident's id is
    // indistinguishable from a nonexistent one here.
    const detail = await getOwnRequestDetail(barangayId, requestId)
    if (!detail) {
      throw new NotFoundError('That request could not be found.')
    }
    if (!isEditable(detail.state)) {
      throwDocumentFailure('not-editable')
    }

    const { answers, fieldErrors } = validateAnswers(
      detail.requirements,
      readAnswers(formData, detail.requirements),
    )
    if (Object.keys(fieldErrors).length > 0) {
      throw new ValidationError('Check the highlighted answers and try again.', fieldErrors)
    }

    await writeAnswers(requestId, answers)

    revalidatePath(`/requests/${requestId}`)
    return ok({ requestId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

/**
 * draft → submitted.
 *
 * A second submission is refused by `submit_request` with ILLEGAL_TRANSITION,
 * which surfaces as a conflict rather than a silent no-op — the resident is
 * told their request is already with the barangay.
 */
export async function submitRequestAction(
  _previous: Result<RequestActionData> | null,
  formData: FormData,
): Promise<Result<RequestActionData>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const context = await requireAuthenticatedUser()

    const parsed = requestActionSchema.safeParse({
      requestId: formData.get('requestId'),
      barangayId: formData.get('barangayId'),
    })
    if (!parsed.success) {
      throw validationErrorFrom(parsed.error.issues)
    }
    const { requestId, barangayId } = parsed.data

    // Proves ownership before the RPC does, so a foreign id never reaches it.
    if (!(await getOwnRequestDetail(barangayId, requestId))) {
      throw new NotFoundError('That request could not be found.')
    }

    unwrap(await documentsService.submitRequest({ p_request_id: requestId }), 'submit_request')

    logger.info('Document request submitted', {
      userId: context.userId,
      barangayId,
      requestId,
    })
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/requests')
    revalidatePath('/dashboard')
    return ok({ requestId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pulls the answer fields out of the form.
 *
 * Driven by the requirement list rather than by whatever the form posted, so a
 * crafted request cannot introduce a key the document type never declared.
 */
function readAnswers(
  formData: FormData,
  requirements: readonly RequirementField[],
): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {}
  for (const requirement of requirements) {
    const raw = formData.get(`${ANSWER_FIELD_PREFIX}${requirement.key}`)
    values[requirement.key] = typeof raw === 'string' ? raw : undefined
  }
  return values
}

async function writeAnswers(
  requestId: string,
  answers: ReadonlyMap<string, string>,
): Promise<void> {
  for (const [requirementId, value] of answers) {
    unwrap(
      await documentsService.setRequestAnswer({
        p_request_id: requestId,
        p_requirement_id: requirementId,
        p_value: value,
      }),
      'set_request_answer',
    )
  }
}

function validationErrorFrom(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
  }
  return new ValidationError('Check the highlighted fields and try again.', fieldErrors)
}
