// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChosenImage } from './use-chosen-image'

const createObjectUrl = vi.fn()
const revokeObjectUrl = vi.fn()

describe('useChosenImage', () => {
  beforeEach(() => {
    let count = 0
    createObjectUrl.mockImplementation(() => `blob:preview-${++count}`)
    URL.createObjectURL = createObjectUrl
    URL.revokeObjectURL = revokeObjectUrl
  })

  afterEach(() => {
    createObjectUrl.mockReset()
    revokeObjectUrl.mockReset()
  })

  it('starts with nothing chosen', () => {
    const { result } = renderHook(() => useChosenImage())
    expect(result.current.chosen).toBeNull()
  })

  it('creates a preview URL for the chosen file', () => {
    const { result } = renderHook(() => useChosenImage())
    const file = new File(['x'], 'login.png', { type: 'image/png' })

    act(() => result.current.choose(file))

    expect(result.current.chosen).toEqual({ file, previewUrl: 'blob:preview-1' })
    expect(createObjectUrl).toHaveBeenCalledWith(file)
  })

  it('releases the previous preview when another file is chosen', () => {
    const { result } = renderHook(() => useChosenImage())
    act(() => result.current.choose(new File(['a'], 'a.png', { type: 'image/png' })))
    act(() => result.current.choose(new File(['b'], 'b.jpg', { type: 'image/jpeg' })))

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-1')
    expect(result.current.chosen?.previewUrl).toBe('blob:preview-2')
  })

  it('releases the preview when the choice is cleared', () => {
    const { result } = renderHook(() => useChosenImage())
    act(() => result.current.choose(new File(['a'], 'a.png', { type: 'image/png' })))
    act(() => result.current.choose(null))

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-1')
    expect(result.current.chosen).toBeNull()
  })

  it('releases the preview when the component unmounts', () => {
    const { result, unmount } = renderHook(() => useChosenImage())
    act(() => result.current.choose(new File(['a'], 'a.png', { type: 'image/png' })))
    unmount()

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-1')
  })

  it('does not release anything on unmount when nothing was chosen', () => {
    const { unmount } = renderHook(() => useChosenImage())
    unmount()
    expect(revokeObjectUrl).not.toHaveBeenCalled()
  })
})
