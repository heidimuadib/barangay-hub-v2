import { z } from 'zod'

export const membershipStatusSchema = z.enum(['invited', 'active', 'disabled'])

export const updateMembershipStatusSchema = z.object({
  barangayId: z.string().uuid(),
  membershipId: z.string().uuid(),
  status: membershipStatusSchema,
})

export const roleAssignmentSchema = z.object({
  barangayId: z.string().uuid(),
  membershipId: z.string().uuid(),
  roleKey: z.string().regex(/^[a-z][a-z_]{1,62}$/),
})

export const inviteMemberSchema = z.object({
  barangayId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email('Enter the exact email address of the account.'),
})
