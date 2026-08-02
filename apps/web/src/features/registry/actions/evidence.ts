'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { ok, resultFromError, toAppError, ValidationError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'

import {
  evidenceFinalizeSchema,
  evidenceReadSchema,
  evidenceRemoveSchema,
  evidenceUploadRequestSchema,
  submitApplicationSchema,
} from '../schemas/registry.schema'
import {
  finalizeEvidenceUpload,
  prepareEvidenceUpload,
  removeOwnEvidence,
  requestEvidenceReadUrl,
} from '../services/evidence-service'
import { registryService, unwrap } from '../services/registry-service'
import type { EvidenceUploadTicket } from '../types/registry'

/**
 * Evidence actions (Slice 2F).
 *
 * The browser receives a one-object upload ticket and nothing else: no bucket
 * listing, no arbitrary path, no service-role credential. Signed URLs are
 * returned to the caller that asked for them and are never logged, never put
 * in a route parameter, and never persisted client-side.
 */

function fieldErrorsOf(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = String(issue.path[issue.path.length - 1] ?? 'form')
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
  }
  return fieldErrors
}

export async function prepareEvidenceUploadAction(
  input: unknown,
): Promise<Result<EvidenceUploadTicket>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = evidenceUploadRequestSchema.safeParse(input)
    if (!parsed.success) {
      throw new ValidationError('That file cannot be uploaded.', fieldErrorsOf(parsed.error.issues))
    }

    const ticket = await prepareEvidenceUpload({
      applicationId: parsed.data.applicationId,
      kind: parsed.data.kind,
      mimeType: parsed.data.mimeType,
      declaredSizeBytes: parsed.data.declaredSizeBytes,
    })

    // Category and ids only — never a filename, never the resident's details.
    logger.info('Evidence upload prepared', {
      evidenceId: ticket.evidenceId,
      kind: parsed.data.kind,
      correlationId,
    })
    return ok(ticket)
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function finalizeEvidenceAction(input: unknown): Promise<Result<{ ok: true }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = evidenceFinalizeSchema.safeParse(input)
    if (!parsed.success) {
      throw new ValidationError(
        'That upload could not be completed.',
        fieldErrorsOf(parsed.error.issues),
      )
    }

    await finalizeEvidenceUpload({
      evidenceId: parsed.data.evidenceId,
      contentHash: parsed.data.contentHash,
    })

    logger.info('Evidence finalized', { evidenceId: parsed.data.evidenceId, correlationId })
    revalidatePath('/verification')
    return ok({ ok: true })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function removeEvidenceAction(input: unknown): Promise<Result<{ ok: true }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = evidenceRemoveSchema.safeParse(input)
    if (!parsed.success) {
      throw new ValidationError('That request was not valid.', fieldErrorsOf(parsed.error.issues))
    }

    // The path is resolved server-side from the id — the client never names
    // an object.
    await removeOwnEvidence(parsed.data.evidenceId)

    logger.info('Evidence removed', { evidenceId: parsed.data.evidenceId, correlationId })
    revalidatePath('/verification')
    return ok({ ok: true })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function submitApplicationAction(
  _previous: Result<{ state: 'submitted' }> | null,
  formData: FormData,
): Promise<Result<{ state: 'submitted' }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = submitApplicationSchema.safeParse({
      applicationId: formData.get('applicationId'),
    })
    if (!parsed.success) {
      throw new ValidationError('That request was not valid.', fieldErrorsOf(parsed.error.issues))
    }

    // The database re-checks ownership, the draft state, and the tightened
    // minimum-evidence rule (one FINALIZED item of each required kind).
    unwrap(
      await registryService.submitVerification({ p_application_id: parsed.data.applicationId }),
      'submit_verification',
    )

    logger.info('Verification application submitted', {
      applicationId: parsed.data.applicationId,
      correlationId,
    })
    revalidatePath('/verification')
    revalidatePath('/dashboard')
    revalidatePath('/staff/verification')
    return ok({ state: 'submitted' })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

/** Staff/resident on-demand read. The URL is returned, never logged. */
export async function requestEvidenceUrlAction(input: unknown): Promise<Result<{ url: string }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = evidenceReadSchema.safeParse(input)
    if (!parsed.success) {
      throw new ValidationError('That request was not valid.', fieldErrorsOf(parsed.error.issues))
    }

    const url = await requestEvidenceReadUrl({
      barangayId: parsed.data.barangayId,
      evidenceId: parsed.data.evidenceId,
    })
    return ok({ url })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}
