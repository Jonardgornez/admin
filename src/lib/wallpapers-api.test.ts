import { afterEach, describe, expect, it, vi } from 'vitest'

import { FALLBACK_ERROR_MESSAGE } from './api'

import { uploadWallpaper } from './wallpapers-api'



const uploadedWallpaper = {

  id: 7,

  sha256: 'd'.repeat(64),

  contentType: 'image/png',

  sizeBytes: 2048,

}



const png = new File([new Uint8Array(2048)], 'wall.png', { type: 'image/png' })



function stubFetch(response: Response) {

  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(response))

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock

}



describe('uploadWallpaper', () => {

  afterEach(() => {

    vi.unstubAllGlobals()

  })



  it('posts the image bytes with their image type and returns the new wallpaper', async () => {

    const fetchMock = stubFetch(Response.json(uploadedWallpaper))



    expect(await uploadWallpaper(png)).toEqual({ success: true, data: uploadedWallpaper })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(url).toBe('/api/wallpapers')

    expect(init.method).toBe('POST')

    expect(init.body).toBe(png)

    expect(init.headers).toEqual({ 'Content-Type': 'image/png' })

  })



  it('accepts a JPEG image', async () => {

    stubFetch(Response.json({ ...uploadedWallpaper, contentType: 'image/jpeg' }))

    const jpeg = new File([new Uint8Array(10)], 'wall.jpg', { type: 'image/jpeg' })



    const result = await uploadWallpaper(jpeg)



    expect(result.success).toBe(true)

  })



  it('refuses a file that is not PNG or JPEG without calling the server', async () => {

    const fetchMock = stubFetch(Response.json(uploadedWallpaper))

    const gif = new File(['gif'], 'anim.gif', { type: 'image/gif' })



    expect(await uploadWallpaper(gif)).toEqual({

      success: false,

      status: 400,

      error: 'Choose a PNG or JPEG image.',

    })

    expect(fetchMock).not.toHaveBeenCalled()

  })



  it('refuses a file over 5 MB without calling the server', async () => {

    const fetchMock = stubFetch(Response.json(uploadedWallpaper))

    const tooBig = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })



    expect(await uploadWallpaper(tooBig)).toEqual({

      success: false,

      status: 400,

      error: 'The image must be 5 MB or smaller.',

    })

    expect(fetchMock).not.toHaveBeenCalled()

  })



  it('shows the server error when the image is rejected', async () => {

    stubFetch(Response.json({ error: 'The image is not a valid PNG.' }, { status: 400 }))



    expect(await uploadWallpaper(png)).toEqual({

      success: false,

      status: 400,

      error: 'The image is not a valid PNG.',

    })

  })



  it('fails with the fallback message when the reply does not match the contract', async () => {

    stubFetch(Response.json({ id: 'seven' }))



    expect(await uploadWallpaper(png)).toEqual({

      success: false,

      status: 200,

      error: FALLBACK_ERROR_MESSAGE,

    })

  })

})

