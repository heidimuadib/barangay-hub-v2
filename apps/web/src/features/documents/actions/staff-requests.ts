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
import { throwDocumentFailure } from '../services/documents-service'
import {
  fileWalkInRequest,
  getStaffRequestDetail,
  markRequestReadyForIssue,
  startRequestReview,
  submitWalkInRequest,
} from '../services/staff-request-service'
import {
  createWalkInRequestSchema,
  requestActionSchema,
  validateAnswers,
} from '../schemas/documents.schema'
import type { RequirementField } from '../types/documents'

/**
 * Staff request handling (Slice 3C).
 *
 * The two transitions carry no free text at all — ids only — because neither
 * of them records a reason: `review_request` and `mark_request_ready` are
 * movements along a queue, not decisions about a person. Contrast Slice 2's
 * rejection, which requires a reason and shows it to the resident.
 *
 * The walk-in path records why staff acted, and that reason IS free text, so
 * it is treated as personal data: never logged, never in a URL, and kept off
 * every audit payload (the trigger records the channel, not the reason).
 */

export interface StaffRequestActionData {
  readonly requestId: string
}

/** submitted → in_review. Requires `requests.review`. */
export async function startReviewAction(
  _previous: Result<StaffRequestActionData> | null,
  formData: FormData,
): Promise<Result<StaffRequestActionData>> {
  return runTransition(formData, 'review', async ({ barangayId, requestId, correlationId }) => {
    await startRequestReview({ barangayId, requestId, correlationId })
  })
}

/** in_review → ready_for_issue. Requires `requests.mark_ready`. */
export async function markReadyAction(
  _previous: Result<StaffRequestActionData> | null,
  formData: FormData,
): Promise<Result<StaffRequestActionData>> {
  return runTransition(formData, 'mark_ready', async ({ barangayId, requestId, correlationId }) => {
    await markRequestReadyForIssue({ barangayId, requestId, correlationId })
  })
}

/**
 * Files a request at the counter and submits it in one operation.
 *
 * Filing a draft that nobody then submits would leave the resident's document
 * invisible to the very queue staff are working from, so the counter flow does
 * both — through the SAME `submit_request` the resident uses.
 */
export async function createWalkInRequestAction(
  _previous: Result<StaffRequestActionData> | null,
  formData: FormData,
): Promise<Result<StaffRequestActionData>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const context = await requireAuthenticatedUser()

    const parsed = createWalkInRequestSchema.safeParse({
      barangayId: formData.get('barangayId'),
      personId: formData.get('personId'),
      documentTypeId: formData.get('documentTypeId'),
      purpose: formData.get('purpose'),
      reason: formData.get('reason'),
    })
    if (!parsed.success) {
      throw validationErrorFrom(parsed.error.issues)
    }
    const { barangayId, personId, documentTypeId, purpose, reason } = parsed.data

    const detail = await getDocumentTypeDetail(barangayId, documentTypeId)
    if (!detail) {
      throwDocumentFailure('type-unavailable')
    }

    const { answers, fieldErrors } = validateAnswers(
      detail.requirements,
      readAnswers(formData, detail.requirements),
    )
    if (Object.keys(fieldErrors).length > 0) {
      throw new ValidationError('Check the highlighted answers and try again.', fieldErrors)
    }

    const requestId = await fileWalkInRequest({
      barangayId,
      personId,
      documentTypeId,
      purpose,
      reason,
      answers,
    })

    await submitWalkInRequest({ barangayId, requestId })

    // The actor, not the reason: the reason is free text about a resident.
    logger.info('Walk-in document request filed', {
      userId: context.userId,
      barangayId,
      requestId,
    })
    revalidatePath('/staff/requests')
    return ok({ requestId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * The shared shape of both transitions: parse, prove the request is visible to
 * this caller in this tenant, run it, revalidate.
 *
 * The existence check is not redundant with the definer function's own: it
 * makes a forged or cross-tenant id a plain not-found here rather than an
 * authorization error from the database, which would otherwise confirm that
 * the id names a real request in some other barangay.
 */
async function runTransition(
  formData: FormData,
  operation: 'review' | 'mark_ready',
  run: (params: {
    barangayId: string
    requestId: string
    correlationId: string | undefined
  }) => Promise<void>,
): Promise<Result<StaffRequestActionData>> {
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

    if (!(await getStaffRequestDetail(barangayId, requestId))) {
      throw new NotFoundError('That request could not be found.')
    }

    await run({ barangayId, requestId, correlationId })

    logger.info('Document request advanced', {
      userId: context.userId,
      barangayId,
      requestId,
      operation,
    })
    revalidatePath(`/staff/requests/${requestId}`)
    revalidatePath('/staff/requests')
    revalidatePath(`/requests/${requestId}`)
    return ok({ requestId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

/**
 * Pulls the answer fields out of the form, driven by the requirement list
 * rather than by whatever was posted — so a crafted request cannot introduce
 * a key the document type never declared.
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

function validationErrorFrom(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
  }
  return new ValidationError('Check the highlighted fields and try again.', fieldErrors)
}
