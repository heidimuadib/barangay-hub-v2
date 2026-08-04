'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { ok, resultFromError, toAppError, ValidationError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER } from '@/lib/logger'

import {
  finalizeRequestEvidenceUpload,
  prepareRequestEvidenceUpload,
  removeOwnRequestEvidence,
  requestEvidenceReadUrl,
} from '../services/request-evidence-service'
import {
  evidenceFinalizeSchema,
  evidenceReadSchema,
  evidenceRemoveSchema,
  evidenceUploadRequestSchema,
} from '../schemas/documents.schema'
import type { RequestEvidenceUploadTicket } from '../types/documents'

/**
 * Supporting-evidence actions (Slice 3D).
 *
 * Plain-object arguments rather than the `useActionState` (previous, FormData)
 * shape, matching Slice 2F: this flow is IMPERATIVE — reserve, PUT the bytes,
 * finalize — driven from an async handler rather than from a form submission.
 * Forcing it through FormData would serialise three calls that are already
 * sequential and hide the ordering that matters.
 *
 * The browser uploads DIRECTLY to the private bucket using the one-object
 * ticket step 1 returns: the bytes never pass through the Next server, and the
 * browser never holds a service-role credential.
 *
 * A signed URL is a bearer credential. It is returned to the caller that asked
 * for it and never logged, never cached, and never rendered into a page.
 */

function validationFrom(issues: readonly { message: string }[], message: string): ValidationError {
  return new ValidationError(message, { file: issues.map((issue) => issue.message) })
}

/** Step 1: reserve the metadata row and return a one-object upload ticket. */
export async function prepareRequestEvidenceAction(input: {
  requestId: string
  mimeType: string
  declaredSizeBytes: number
}): Promise<Result<RequestEvidenceUploadTicket>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined
  try {
    const parsed = evidenceUploadRequestSchema.safeParse(input)
    if (!parsed.success) {
      throw validationFrom(parsed.error.issues, 'That file cannot be attached.')
    }
    return ok(await prepareRequestEvidenceUpload(parsed.data))
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

/** Step 2: finalize, after the browser has actually put the bytes there. */
export async function finalizeRequestEvidenceAction(input: {
  evidenceId: string
  requestId: string
  contentHash: string
}): Promise<Result<{ evidenceId: string }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined
  try {
    const parsed = evidenceFinalizeSchema.safeParse(input)
    if (!parsed.success) {
      throw validationFrom(parsed.error.issues, 'That upload could not be confirmed.')
    }

    await finalizeRequestEvidenceUpload({
      evidenceId: parsed.data.evidenceId,
      contentHash: parsed.data.contentHash,
    })

    revalidatePath(`/requests/${parsed.data.requestId}`)
    return ok({ evidenceId: parsed.data.evidenceId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function removeRequestEvidenceAction(input: {
  evidenceId: string
  requestId: string
}): Promise<Result<{ evidenceId: string }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined
  try {
    const parsed = evidenceRemoveSchema.safeParse(input)
    if (!parsed.success) {
      throw validationFrom(parsed.error.issues, 'That document could not be removed.')
    }

    await removeOwnRequestEvidence(parsed.data.evidenceId)
    revalidatePath(`/requests/${parsed.data.requestId}`)
    return ok({ evidenceId: parsed.data.evidenceId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

/**
 * Mints a short-lived read URL on demand, for a reviewer who pressed "View".
 *
 * Deliberately an action rather than page data: a URL embedded at render time
 * would be a live credential sitting in the HTML of a page that may be open,
 * screenshotted, or left on a shared counter machine.
 */
export async function requestEvidenceUrlAction(input: {
  evidenceId: string
  barangayId: string
}): Promise<Result<{ url: string }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined
  try {
    const parsed = evidenceReadSchema.safeParse(input)
    if (!parsed.success) {
      throw validationFrom(parsed.error.issues, 'That document could not be opened.')
    }
    return ok({ url: await requestEvidenceReadUrl(parsed.data) })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}
