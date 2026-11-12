import { z } from 'zod'
import { MAX_PC_NUMBER } from './pcs'

export const PC_NUMBER_ERROR = `Enter a whole number from 1 to ${MAX_PC_NUMBER}.`

// The field holds text, so it is read as digits first and then checked as a number in range.
export const renamePcSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, 'Enter the PC number.')
    .regex(/^\d+$/, PC_NUMBER_ERROR)
    .transform(Number)
    .pipe(z.number().int().min(1, PC_NUMBER_ERROR).max(MAX_PC_NUMBER, PC_NUMBER_ERROR)),
})

export type RenamePcInput = z.input<typeof renamePcSchema>
export type RenamePcValues = z.infer<typeof renamePcSchema>
