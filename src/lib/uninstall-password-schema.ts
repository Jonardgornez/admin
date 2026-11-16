import { z } from 'zod'
import { MAX_PASSWORD_LENGTH, MIN_NEW_PASSWORD_LENGTH } from './auth-schemas'

export const uninstallPasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_NEW_PASSWORD_LENGTH, `Password must be at least ${MIN_NEW_PASSWORD_LENGTH} characters.`)
      .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`),
    confirmPassword: z.string().min(1, 'Confirm the password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

export type UninstallPasswordValues = z.infer<typeof uninstallPasswordSchema>
