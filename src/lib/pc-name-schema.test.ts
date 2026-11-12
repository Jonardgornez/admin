import { describe, expect, it } from 'vitest'
import { PC_NUMBER_ERROR, renamePcSchema } from './pc-name-schema'

function firstError(number: string): string | undefined {
  const result = renamePcSchema.safeParse({ number })
  return result.success ? undefined : result.error.issues[0].message
}

describe('renamePcSchema', () => {
  it('reads the typed digits as a number', () => {
    expect(renamePcSchema.parse({ number: ' 9 ' })).toEqual({ number: 9 })
    expect(renamePcSchema.parse({ number: '999999999' })).toEqual({ number: 999_999_999 })
  })

  it('asks for a number when the field is empty', () => {
    expect(firstError('  ')).toBe('Enter the PC number.')
  })

  it.each(['0', '1000000000', '-3', '2.5', 'abc', '1e3'])('refuses %s', (number) => {
    expect(firstError(number)).toBe(PC_NUMBER_ERROR)
  })
})
