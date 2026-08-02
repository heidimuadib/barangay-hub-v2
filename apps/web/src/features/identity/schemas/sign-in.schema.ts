import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter the email address for your account.'),
  password: z.string().min(1, 'Enter your password.'),
})

export type SignInInput = z.infer<typeof signInSchema>

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter a display name.')
    .max(120, 'Display names are at most 120 characters.'),
})
