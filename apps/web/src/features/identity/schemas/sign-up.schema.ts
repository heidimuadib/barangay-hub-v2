import { z } from 'zod'

/**
 * Public sign-up input (ADR-0006 Option C).
 *
 * The password floor is deliberately a length rule and nothing else:
 * composition rules push people towards predictable substitutions, and the
 * account proves no identity anyway — verification does that. Supabase Auth
 * applies its own minimum on top.
 */
export const signUpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    password: z
      .string()
      .min(12, 'Use at least 12 characters.')
      .max(72, 'Passwords are limited to 72 characters.'),
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'The two passwords do not match.',
      })
    }
  })

export type SignUpInput = z.infer<typeof signUpSchema>
