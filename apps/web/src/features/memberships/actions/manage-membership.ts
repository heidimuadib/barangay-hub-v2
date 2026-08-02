'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
  ok,
  resultFromError,
  toAppError,
  type Result,
} from '@/lib/errors'
import { CORRELATION_HEADER, logger } from '@/lib/logger'

import {
  assignRole,
  changeMembershipStatus,
  inviteMember,
  removeRole,
} from '../services/roster-service'
import {
  inviteMemberSchema,
  roleAssignmentSchema,
  updateMembershipStatusSchema,
} from '../schemas/manage.schema'

/**
 * Slice 1 admin mutations. Every action validates input shape (zod) and
 * delegates to the service, which passes the audited permission gate and
 * mutates through the caller's OWN session — so RLS enforces the same rule a
 * second time and the database triggers audit the change. Wrong-tenant and
 * non-existent targets report identically (Phase 4 §13.6).
 */

const MEMBERS_PATH = '/staff/members'

async function correlationId(): Promise<string | undefined> {
  return (await headers()).get(CORRELATION_HEADER) ?? undefined
}

export async function updateMembershipStatusAction(
  _previous: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const correlation = await correlationId()
  try {
    const parsed = updateMembershipStatusSchema.safeParse({
      barangayId: formData.get('barangayId'),
      membershipId: formData.get('membershipId'),
      status: formData.get('status'),
    })
    if (!parsed.success) {
      throw new ValidationError('That change could not be read. Reload the page and try again.')
    }

    const changed = await changeMembershipStatus(parsed.data)
    if (!changed) {
      throw new NotFoundError('That member could not be found.')
    }

    logger.info('Membership status changed', {
      membershipId: parsed.data.membershipId,
      status: parsed.data.status,
    })
    revalidatePath(MEMBERS_PATH)
    return ok(null)
  } catch (error) {
    return resultFromError(toAppError(error, correlation), correlation)
  }
}

export async function assignRoleAction(
  _previous: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const correlation = await correlationId()
  try {
    const parsed = roleAssignmentSchema.safeParse({
      barangayId: formData.get('barangayId'),
      membershipId: formData.get('membershipId'),
      roleKey: formData.get('roleKey'),
    })
    if (!parsed.success) {
      throw new ValidationError('That change could not be read. Reload the page and try again.')
    }

    const outcome = await assignRole(parsed.data)
    if (outcome === 'duplicate') {
      throw new ConflictError('That member already has this role.')
    }
    if (outcome === 'not-found') {
      throw new NotFoundError('That member could not be found.')
    }
    if (outcome === 'denied') {
      // requirePermission passed but RLS refused — permissions changed
      // mid-request. The database is the authority.
      throw new AuthorizationError('You do not have permission to do that.')
    }

    logger.info('Role assigned', {
      membershipId: parsed.data.membershipId,
      roleKey: parsed.data.roleKey,
    })
    revalidatePath(MEMBERS_PATH)
    return ok(null)
  } catch (error) {
    return resultFromError(toAppError(error, correlation), correlation)
  }
}

export async function removeRoleAction(
  _previous: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const correlation = await correlationId()
  try {
    const parsed = roleAssignmentSchema.safeParse({
      barangayId: formData.get('barangayId'),
      membershipId: formData.get('membershipId'),
      roleKey: formData.get('roleKey'),
    })
    if (!parsed.success) {
      throw new ValidationError('That change could not be read. Reload the page and try again.')
    }

    const removed = await removeRole(parsed.data)
    if (!removed) {
      throw new NotFoundError('That role assignment could not be found.')
    }

    logger.info('Role removed', {
      membershipId: parsed.data.membershipId,
      roleKey: parsed.data.roleKey,
    })
    revalidatePath(MEMBERS_PATH)
    return ok(null)
  } catch (error) {
    return resultFromError(toAppError(error, correlation), correlation)
  }
}

export async function inviteMemberAction(
  _previous: Result<{ invited: true }> | null,
  formData: FormData,
): Promise<Result<{ invited: true }>> {
  const correlation = await correlationId()
  try {
    const parsed = inviteMemberSchema.safeParse({
      barangayId: formData.get('barangayId'),
      email: formData.get('email'),
    })
    if (!parsed.success) {
      throw new ValidationError('Check the email address.', {
        email: ['Enter the exact email address of the account to invite.'],
      })
    }

    const outcome = await inviteMember({
      barangayId: parsed.data.barangayId,
      email: parsed.data.email,
      ...(correlation === undefined ? {} : { correlationId: correlation }),
    })
    if (outcome.kind === 'denied') {
      throw new AuthorizationError('You do not have permission to do that.')
    }
    if (outcome.kind === 'not-eligible') {
      // Uniform wording for "no such account" and "already a member" — the
      // database enforces the same uniformity (anti-enumeration).
      throw new BusinessRuleError(
        'BR-INV-1',
        'That address cannot be invited. It may not have an account yet, or it may already be a member. Confirm the address with the person directly.',
      )
    }

    logger.info('Membership invited', { membershipId: outcome.membershipId })
    revalidatePath(MEMBERS_PATH)
    return ok({ invited: true })
  } catch (error) {
    return resultFromError(toAppError(error, correlation), correlation)
  }
}
