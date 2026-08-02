'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { ok, resultFromError, toAppError, ValidationError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'

import {
  rejectSchema,
  requestInformationSchema,
  resubmitSchema,
  reviewActionSchema,
} from '../schemas/registry.schema'
import {
  approveApplication,
  rejectApplication,
  requestMoreInformation,
  resubmitOwnApplication,
  startReview,
} from '../services/verification-service'
import type { VerificationState } from '../types/registry'

/**
 * Verification workflow actions (Slice 2D).
 *
 * POST-only Server Actions: ids, a staff note and a rejection reason are the
 * only payloads, and none of them ever enters a URL (P6-C-E). Every action
 * re-authorizes through the audited guard AND the definer function — the UI
 * hiding a button is never the control. Log lines carry ids and states only;
 * the note and reason texts are stored on the application row, not logged.
 */

export type VerificationActionResult = Result<{ readonly state: VerificationState }>

function firstIssueMap(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = String(issue.path[issue.path.length - 1] ?? 'form')
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
  }
  return fieldErrors
}

function revalidateStaffViews(applicationId: string): void {
  revalidatePath('/staff/verification')
  revalidatePath(`/staff/verification/${applicationId}`)
}

export async function startReviewAction(
  _previous: VerificationActionResult | null,
  formData: FormData,
): Promise<VerificationActionResult> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = reviewActionSchema.safeParse({
      barangayId: formData.get('barangayId'),
      applicationId: formData.get('applicationId'),
    })
    if (!parsed.success) {
      throw new ValidationError('That request was not valid.', firstIssueMap(parsed.error.issues))
    }

    await startReview(parsed.data.barangayId, parsed.data.applicationId)

    logger.info('Verification review started', {
      applicationId: parsed.data.applicationId,
      correlationId,
    })
    revalidateStaffViews(parsed.data.applicationId)
    return ok({ state: 'in_review' })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function requestInformationAction(
  _previous: VerificationActionResult | null,
  formData: FormData,
): Promise<VerificationActionResult> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = requestInformationSchema.safeParse({
      barangayId: formData.get('barangayId'),
      applicationId: formData.get('applicationId'),
      note: formData.get('note'),
    })
    if (!parsed.success) {
      throw new ValidationError(
        'Check the highlighted fields and try again.',
        firstIssueMap(parsed.error.issues),
      )
    }

    await requestMoreInformation({
      barangayId: parsed.data.barangayId,
      applicationId: parsed.data.applicationId,
      note: parsed.data.note,
      correlationId,
    })

    // The note reaches the resident and the application row — never the log.
    logger.info('Verification information requested', {
      applicationId: parsed.data.applicationId,
      correlationId,
    })
    revalidateStaffViews(parsed.data.applicationId)
    return ok({ state: 'info_requested' })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function approveApplicationAction(
  _previous: VerificationActionResult | null,
  formData: FormData,
): Promise<VerificationActionResult> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = reviewActionSchema.safeParse({
      barangayId: formData.get('barangayId'),
      applicationId: formData.get('applicationId'),
    })
    if (!parsed.success) {
      throw new ValidationError('That request was not valid.', firstIssueMap(parsed.error.issues))
    }

    await approveApplication({
      barangayId: parsed.data.barangayId,
      applicationId: parsed.data.applicationId,
      correlationId,
    })

    logger.info('Verification application approved', {
      applicationId: parsed.data.applicationId,
      correlationId,
    })
    revalidateStaffViews(parsed.data.applicationId)
    revalidatePath('/verification')
    revalidatePath('/dashboard')
    return ok({ state: 'approved' })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function rejectApplicationAction(
  _previous: VerificationActionResult | null,
  formData: FormData,
): Promise<VerificationActionResult> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = rejectSchema.safeParse({
      barangayId: formData.get('barangayId'),
      applicationId: formData.get('applicationId'),
      reason: formData.get('reason'),
    })
    if (!parsed.success) {
      throw new ValidationError(
        'Check the highlighted fields and try again.',
        firstIssueMap(parsed.error.issues),
      )
    }

    await rejectApplication({
      barangayId: parsed.data.barangayId,
      applicationId: parsed.data.applicationId,
      reason: parsed.data.reason,
      correlationId,
    })

    // Reason text is stored on the row and shown to the resident — not logged.
    logger.info('Verification application rejected', {
      applicationId: parsed.data.applicationId,
      correlationId,
    })
    revalidateStaffViews(parsed.data.applicationId)
    revalidatePath('/verification')
    revalidatePath('/dashboard')
    return ok({ state: 'rejected' })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function resubmitApplicationAction(
  _previous: VerificationActionResult | null,
  formData: FormData,
): Promise<VerificationActionResult> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = resubmitSchema.safeParse({
      applicationId: formData.get('applicationId'),
    })
    if (!parsed.success) {
      throw new ValidationError('That request was not valid.', firstIssueMap(parsed.error.issues))
    }

    await resubmitOwnApplication(parsed.data.applicationId, correlationId)

    logger.info('Verification application resubmitted', {
      applicationId: parsed.data.applicationId,
      correlationId,
    })
    revalidatePath('/verification')
    revalidatePath('/dashboard')
    revalidatePath('/staff/verification')
    return ok({ state: 'resubmitted' })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}
