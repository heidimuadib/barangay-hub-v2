'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { ok, resultFromError, toAppError, ValidationError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'

import { supersedeSchema } from '../schemas/registry.schema'
import { resolveDuplicateBySupersede } from '../services/staff-registry-service'

/**
 * Supersede-and-link resolution (Slice 2E; ADR-0006 §D2-02).
 *
 * POST-only: ids and the staff-authored reason are the whole payload, and
 * none of it enters a URL. The action re-authorizes through the audited
 * guard (`registry.resolve_duplicates`) and the definer function re-checks
 * capability and every eligibility rule — the UI offering the control is
 * never the boundary. Log lines carry ids only; the reason lives on the
 * superseded row as the accountability record.
 */

export type ResolveDuplicateResult = Result<{
  readonly survivorPersonId: string
  readonly supersededPersonId: string
}>

export async function resolveDuplicateAction(
  _previous: ResolveDuplicateResult | null,
  formData: FormData,
): Promise<ResolveDuplicateResult> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = supersedeSchema.safeParse({
      barangayId: formData.get('barangayId'),
      loserPersonId: formData.get('loserPersonId'),
      survivorPersonId: formData.get('survivorPersonId'),
      reason: formData.get('reason'),
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[issue.path.length - 1] ?? 'form')
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new ValidationError('Check the highlighted fields and try again.', fieldErrors)
    }

    await resolveDuplicateBySupersede({
      barangayId: parsed.data.barangayId,
      loserPersonId: parsed.data.loserPersonId,
      survivorPersonId: parsed.data.survivorPersonId,
      reason: parsed.data.reason,
    })

    logger.info('Duplicate resolved by supersede', {
      survivorPersonId: parsed.data.survivorPersonId,
      supersededPersonId: parsed.data.loserPersonId,
      correlationId,
    })
    revalidatePath('/staff/registry')
    revalidatePath(`/staff/registry/${parsed.data.survivorPersonId}`)
    revalidatePath(`/staff/registry/${parsed.data.loserPersonId}`)
    return ok({
      survivorPersonId: parsed.data.survivorPersonId,
      supersededPersonId: parsed.data.loserPersonId,
    })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}
