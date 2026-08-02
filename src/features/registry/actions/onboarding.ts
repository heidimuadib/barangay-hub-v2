'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { requireAuthenticatedUser } from '@/features/identity'
import { ok, resultFromError, toAppError, ValidationError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'

import { personDetailsSchema } from '../schemas/registry.schema'
import { registryService, unwrap } from '../services/registry-service'

/**
 * Resident onboarding (ADR-0006 Option C).
 *
 * Creates the person record through `create_own_person`, which is the SAME
 * registry the staff walk-in path writes to (point 6), then opens a draft
 * verification application. Both run inside their own database transactions
 * with trigger-written audit entries.
 *
 * The account itself confers nothing: the resident stays unverified until a
 * reviewer approves the application (point 4).
 */
export async function completeOnboardingAction(
  _previous: Result<{ personId: string }> | null,
  formData: FormData,
): Promise<Result<{ personId: string }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const context = await requireAuthenticatedUser()

    const parsed = personDetailsSchema.safeParse({
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
    })

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new ValidationError('Check the highlighted fields and try again.', fieldErrors)
    }

    const details = parsed.data
    const personId = unwrap(
      await registryService.createOwnPerson({
        p_barangay_id: details.barangayId,
        p_first_name: details.firstName,
        p_last_name: details.lastName,
        p_residency_basis: details.residencyBasis,
        ...(details.middleName === undefined ? {} : { p_middle_name: details.middleName }),
        ...(details.suffix === undefined ? {} : { p_suffix: details.suffix }),
        ...(details.birthdate === undefined ? {} : { p_birthdate: details.birthdate }),
        ...(details.contactPhone === undefined ? {} : { p_contact_phone: details.contactPhone }),
        ...(details.addressLine === undefined ? {} : { p_address_line: details.addressLine }),
        ...(details.residencyExplanation === undefined
          ? {}
          : { p_residency_explanation: details.residencyExplanation }),
      }),
      'create_own_person',
    )

    // Open the draft immediately: the resident's next step is evidence, and a
    // person with no application would strand them with nothing to act on.
    unwrap(
      await registryService.createVerificationApplication({ p_person_id: personId }),
      'create_verification_application',
    )

    logger.info('Resident onboarding completed', { userId: context.userId })
    revalidatePath('/verification')
    revalidatePath('/dashboard')
    return ok({ personId })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}
