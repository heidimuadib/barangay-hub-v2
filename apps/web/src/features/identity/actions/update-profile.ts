'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { NotFoundError, ValidationError } from '@/lib/errors'
import { ok, resultFromError, toAppError, type Result } from '@/lib/errors'
import { CORRELATION_HEADER } from '@/lib/logger'

import { updateProfileSchema } from '../schemas/sign-in.schema'
import { requireAuthenticatedUser } from '../services/authorization'
import { updateDisplayName } from '../services/profile-service'

export async function updateProfileAction(
  _previous: Result<{ displayName: string }> | null,
  formData: FormData,
): Promise<Result<{ displayName: string }>> {
  const correlationId = (await headers()).get(CORRELATION_HEADER) ?? undefined

  try {
    const context = await requireAuthenticatedUser()

    const parsed = updateProfileSchema.safeParse({ displayName: formData.get('displayName') })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError('Check the display name and try again.', {
        displayName: [issue?.message ?? 'Enter a valid display name.'],
      })
    }

    // RLS restricts the row (own profile) and the column grant restricts the
    // field (display_name). The update is audited by the database trigger.
    const updated = await updateDisplayName(context.userId, parsed.data.displayName)
    if (!updated) {
      throw new NotFoundError('Your profile could not be found.')
    }

    revalidatePath('/account')
    return ok({ displayName: parsed.data.displayName })
  } catch (error) {
    return resultFromError(toAppError(error, correlationId), correlationId)
  }
}
