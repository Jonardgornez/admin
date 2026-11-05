import { z } from 'zod'

export const MAX_PASSWORD_LENGTH = 128
export const MIN_NEW_PASSWORD_LENGTH = 8

export const signInSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username.'),
  password: z
    .string()
    .min(1, 'Enter your password.')
    .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`),
})

export type SignInValues = z.infer<typeof signInSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Enter your current password.')
      .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`),
    newPassword: z
      .string()
      .min(MIN_NEW_PASSWORD_LENGTH, `New password must be at least ${MIN_NEW_PASSWORD_LENGTH} characters.`)
      .max(MAX_PASSWORD_LENGTH, `New password must be at most ${MAX_PASSWORD_LENGTH} characters.`)
      .refine((value) => value.trim().length > 0, 'New password cannot be only spaces.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current one.',
  })

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
