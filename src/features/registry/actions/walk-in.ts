'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { ok, resultFromError, toAppError, ValidationError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'

import { registrySearchSchema, walkInCreateSchema } from '../schemas/registry.schema'
import {
  createWalkIn,
  findDuplicateCandidates,
  searchRegistry,
} from '../services/staff-registry-service'
import type { DuplicateCandidate, PersonSearchHit } from '../types/registry'

/**
 * Staff-assisted registry actions (Slice 2C).
 *
 * Both actions are POST-only Server Actions, which is what keeps resident
 * names, birthdates and contact details out of URLs (P6-C-E): there is no
 * route that accepts a search term or a person's details as a query
 * parameter.
 */

export type WalkInOutcome =
  | { readonly status: 'created'; readonly personId: string }
  | { readonly status: 'duplicates'; readonly candidates: readonly DuplicateCandidate[] }

export async function createWalkInAction(
  _previous: Result<WalkInOutcome> | null,
  formData: FormData,
): Promise<Result<WalkInOutcome>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = walkInCreateSchema.safeParse({
      details: {
        barangayId: formData.get('barangayId'),
        firstName: formData.get('firstName'),
        middleName: emptyToUndefined(formData.get('middleName')),
        lastName: formData.get('lastName'),
        suffix: emptyToUndefined(formData.get('suffix')),
        birthdate: emptyToUndefined(formData.get('birthdate')),
        contactPhone: emptyToUndefined(formData.get('contactPhone')),
        addressLine: emptyToUndefined(formData.get('addressLine')),
        residencyBasis: formData.get('residencyBasis'),
        residencyExplanation: emptyToUndefined(formData.get('residencyExplanation')),
      },
      reason: formData.get('reason'),
    })

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        // `details.firstName` → `firstName`, so the form can map errors to
        // inputs without knowing the nesting.
        const key = String(issue.path[issue.path.length - 1] ?? 'form')
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new ValidationError('Check the highlighted fields and try again.', fieldErrors)
    }

    const { details, reason } = parsed.data
    const acknowledged = formData.get('acknowledgeDuplicates') === 'yes'

    // Duplicate candidates are a WARNING, never a merge (ADR-0006 points
    // 9–11). Staff must see them once and confirm deliberately; resolution
    // lives in subpart 2E behind its own capability.
    if (!acknowledged) {
      const candidates = await findDuplicateCandidates({
        barangayId: details.barangayId,
        firstName: details.firstName,
        lastName: details.lastName,
        ...(details.birthdate === undefined ? {} : { birthdate: details.birthdate }),
      })
      if (candidates.length > 0) {
        logger.info('Walk-in creation paused on duplicate candidates', {
          candidateCount: candidates.length,
        })
        return ok({ status: 'duplicates', candidates })
      }
    }

    const personId = await createWalkIn({
      barangayId: details.barangayId,
      firstName: details.firstName,
      lastName: details.lastName,
      residencyBasis: details.residencyBasis,
      reason,
      ...(details.middleName === undefined ? {} : { middleName: details.middleName }),
      ...(details.suffix === undefined ? {} : { suffix: details.suffix }),
      ...(details.birthdate === undefined ? {} : { birthdate: details.birthdate }),
      ...(details.contactPhone === undefined ? {} : { contactPhone: details.contactPhone }),
      ...(details.addressLine === undefined ? {} : { addressLine: details.addressLine }),
      ...(details.residencyExplanation === undefined
        ? {}
        : { residencyExplanation: details.residencyExplanation }),
    })

    // IDs only — names and contact details never enter a log line.
    logger.info('Walk-in person created', { personId, acknowledgedDuplicates: acknowledged })
    revalidatePath('/staff/registry')
    return ok({ status: 'created', personId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

export async function searchRegistryAction(
  _previous: Result<readonly PersonSearchHit[]> | null,
  formData: FormData,
): Promise<Result<readonly PersonSearchHit[]>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const parsed = registrySearchSchema.safeParse({
      barangayId: formData.get('barangayId'),
      term: formData.get('term'),
    })
    if (!parsed.success) {
      throw new ValidationError('Check the search box and try again.', {
        term: [parsed.error.issues[0]?.message ?? 'Enter a search term.'],
      })
    }

    const hits = await searchRegistry(parsed.data.barangayId, parsed.data.term)
    // Result COUNT only. The term itself is a resident's name or address and
    // must not reach the logs (Phase 6 §37.2).
    logger.info('Registry search performed', { resultCount: hits.length })
    return ok(hits)
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}
