import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_MAX_BYTES,
  backgroundFileSchema,
  getBackgroundFileError,
} from './background-schema'

const TYPE_MESSAGE = 'Choose a PNG or JPEG image.'
const SIZE_MESSAGE = 'The image must be 5 MB or smaller.'

function makeFile(type: string, sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], 'background', { type })
}

describe('backgroundFileSchema', () => {
  it.each(['image/png', 'image/jpeg'])('accepts %s', (type) => {
    expect(backgroundFileSchema.safeParse(makeFile(type)).success).toBe(true)
  })

  it.each(['image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', ''])(
    'rejects the type "%s" with the type message',
    (type) => {
      const result = backgroundFileSchema.safeParse(makeFile(type))
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe(TYPE_MESSAGE)
    },
  )

  it('accepts a file of exactly the maximum size', () => {
    expect(
      backgroundFileSchema.safeParse(makeFile('image/png', BACKGROUND_MAX_BYTES)).success,
    ).toBe(true)
  })

  it('rejects a file one byte over the maximum size', () => {
    const result = backgroundFileSchema.safeParse(makeFile('image/png', BACKGROUND_MAX_BYTES + 1))
    expect(result.error?.issues[0].message).toBe(SIZE_MESSAGE)
  })

  it('rejects something that is not a File', () => {
    expect(backgroundFileSchema.safeParse('image.png').success).toBe(false)
  })
})

describe('getBackgroundFileError', () => {
  it('returns null for a valid PNG', () => {
    expect(getBackgroundFileError(makeFile('image/png'))).toBeNull()
  })

  it('reports the type problem first when a file is both the wrong type and too large', () => {
    const file = makeFile('image/gif', BACKGROUND_MAX_BYTES + 1)
    expect(getBackgroundFileError(file)).toBe(TYPE_MESSAGE)
  })

  it('reports the size problem for an oversized JPEG', () => {
    expect(getBackgroundFileError(makeFile('image/jpeg', BACKGROUND_MAX_BYTES + 1))).toBe(
      SIZE_MESSAGE,
    )
  })
})
