import { afterEach, describe, expect, it, vi } from 'vitest'

import { FALLBACK_ERROR_MESSAGE } from './api'

import {

  bulkLockPcs,

  bulkRebootPcs,

  bulkShutDownPcs,

  bulkUnlockPcs,

  cancelPcPower,

  cancelPcsClientUpdate,

  cancelPcsPower,

  editPcTime,

  listPcs,

  lockPc,

  queuePcsClientUpdate,

  rebootPc,

  removePc,

  shutDownPc,

  unlockPc,

} from './pcs-api'



const serverPc = {

  id: 3,

  name: 'PC-03',

  isOnline: true,

  isLocked: false,

  ipAddress: '192.168.1.13',

  registeredAt: '2026-11-01T08:00:00.000Z',

  lastSeenAt: '2026-11-05T10:00:00.000Z',

  session: null,

  shutdownState: null,

  isServerPc: false,

  internetBlocked: false,

  internetBlockApplied: null,

  clientVersion: null,

  clientUpdate: null,

}



function stubFetch(response: Response | Error) {

  const fetchMock = vi.fn(() =>

    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),

  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock

}



describe('pcs api', () => {

  afterEach(() => {

    vi.unstubAllGlobals()

  })



  describe('listPcs', () => {

    it('gets the registered PCs', async () => {

      const fetchMock = stubFetch(Response.json([serverPc, { ...serverPc, id: 4, ipAddress: null }]))

      expect(await listPcs()).toEqual({

        success: true,

        data: [serverPc, { ...serverPc, id: 4, ipAddress: null }],

      })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs',

        expect.objectContaining({ method: 'GET', headers: undefined }),

      )

    })



    it('marks background requests with the refresh header', async () => {

      const fetchMock = stubFetch(Response.json([]))

      await listPcs({ isBackground: true })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs',

        expect.objectContaining({ headers: { 'X-Background-Refresh': '1' } }),

      )

    })



    it('drops fields the server sends beyond the contract', async () => {

      stubFetch(Response.json([{ ...serverPc, token: 'secret' }]))

      expect(await listPcs()).toEqual({ success: true, data: [serverPc] })

    })



    it('keeps a timed session', async () => {

      const session = {

        username: 'maria',

        startedAt: '2026-11-05T09:00:00.000Z',

        time: { mode: 'time-limit', minutes: 60 },

        secondsRemaining: 1800,

      }

      stubFetch(Response.json([{ ...serverPc, session }]))

      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, session }] })

    })



    it('keeps an open time session with no seconds remaining', async () => {

      const session = {

        username: 'maria',

        startedAt: '2026-11-05T09:00:00.000Z',

        time: { mode: 'open-time' },

        secondsRemaining: null,

      }

      stubFetch(Response.json([{ ...serverPc, session }]))

      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, session }] })

    })



    it('keeps an admin unlock session with no username', async () => {

      const session = {

        username: null,

        startedAt: '2026-11-05T09:00:00.000Z',

        time: { mode: 'open-time' },

        secondsRemaining: null,

      }

      stubFetch(Response.json([{ ...serverPc, session }]))

      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, session }] })

    })



    it.each([

      ['a missing username', { startedAt: 'x', time: { mode: 'open-time' }, secondsRemaining: null }],

      ['an unknown time mode', { username: 'a', startedAt: 'x', time: { mode: 'forever' }, secondsRemaining: null }],

      ['text seconds remaining', { username: 'a', startedAt: 'x', time: { mode: 'open-time' }, secondsRemaining: '5' }],

    ])('fails on a malformed session with %s', async (_label, session) => {

      stubFetch(Response.json([{ ...serverPc, session }]))

      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it('fails when the session field is missing', async () => {

      const { session: _session, ...withoutSession } = serverPc

      stubFetch(Response.json([withoutSession]))

      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it('keeps the lock flag of a locked PC', async () => {

      stubFetch(Response.json([{ ...serverPc, isLocked: true }]))

      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, isLocked: true }] })

    })



    it('fails when the lock flag is missing', async () => {

      const { isLocked: _isLocked, ...withoutLockFlag } = serverPc

      stubFetch(Response.json([withoutLockFlag]))

      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it.each([

      ['shutting-down', 'shutting-down'],

      ['shutdown', 'shutdown'],

      ['restarting', 'restarting'],

      ['rebooting', 'rebooting'],

      ['cancelling', 'cancelling'],

      [null, null],

    ])('keeps a shutdown state of %s', async (_label, shutdownState) => {

      stubFetch(Response.json([{ ...serverPc, shutdownState }]))

      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, shutdownState }] })

    })



    it('keeps the server PC flag', async () => {

      stubFetch(Response.json([{ ...serverPc, isServerPc: true }]))

      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, isServerPc: true }] })

    })



    it('keeps the internet block flag and the client report', async () => {

      const blocked = { ...serverPc, internetBlocked: true, internetBlockApplied: true }

      stubFetch(Response.json([blocked]))

      expect(await listPcs()).toEqual({ success: true, data: [blocked] })

    })



    it('defaults the internet fields when an older server omits them', async () => {

      const { internetBlocked: _blocked, internetBlockApplied: _applied, ...olderServerPc } = serverPc

      stubFetch(Response.json([olderServerPc]))

      expect(await listPcs()).toEqual({

        success: true,

        data: [{ ...olderServerPc, internetBlocked: false, internetBlockApplied: null }],

      })

    })



    it('fails when the internet block flag is not a boolean', async () => {

      stubFetch(Response.json([{ ...serverPc, internetBlocked: 'yes' }]))

      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it('fails on an unknown shutdown state', async () => {

      stubFetch(Response.json([{ ...serverPc, shutdownState: 'hibernating' }]))

      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it('fails when the server PC flag is missing', async () => {

      const { isServerPc: _isServerPc, ...withoutServerFlag } = serverPc

      stubFetch(Response.json([withoutServerFlag]))

      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it('fails with the fallback message on a malformed body', async () => {

      stubFetch(Response.json([{ ...serverPc, isOnline: 'yes' }]))

      expect(await listPcs()).toEqual({

        success: false,

        status: 200,

        error: FALLBACK_ERROR_MESSAGE,

      })

    })



    it('fails when the body is not a list', async () => {

      stubFetch(Response.json({ pcs: [serverPc] }))

      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it('returns the status and message of an error response', async () => {

      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))

      expect(await listPcs()).toEqual({ success: false, status: 401, error: 'Sign in again.' })

    })

  })



  describe('removePc', () => {

    it('deletes the PC by id', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await removePc(7)).toEqual({ success: true, data: undefined })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7',

        expect.objectContaining({ method: 'DELETE' }),

      )

    })



    it.each([404, 409])('returns the server message on %i', async (status) => {

      stubFetch(Response.json({ error: 'Nope.' }, { status }))

      expect(await removePc(7)).toEqual({ success: false, status, error: 'Nope.' })

    })

  })



  describe('lockPc and unlockPc', () => {

    it('posts the message to the lock route of the PC', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await lockPc(7, 'Back at 10:00.')).toEqual({ success: true, data: undefined })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7/lock',

        expect.objectContaining({ method: 'POST', body: '{"message":"Back at 10:00."}' }),

      )

    })



    it('posts a null message when the default from Settings should be used', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await lockPc(7, null)).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/7/lock',
        expect.objectContaining({ method: 'POST', body: '{"message":null}' }),
      )
    })

    it('posts to the unlock route of the PC', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await unlockPc(7)).toEqual({ success: true, data: undefined })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7/unlock',

        expect.objectContaining({ method: 'POST', body: '{}' }),

      )

    })



    it.each([404, 409])('returns the server message on %i', async (status) => {

      stubFetch(Response.json({ error: 'This PC is offline.' }, { status }))

      expect(await unlockPc(7)).toEqual({ success: false, status, error: 'This PC is offline.' })

    })

  })



  describe('editPcTime', () => {

    it('posts an add-time command with the minutes to the time route of the PC', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await editPcTime(7, { action: 'add-time', minutes: 90 })).toEqual({

        success: true,

        data: undefined,

      })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7/time',

        expect.objectContaining({

          method: 'POST',

          body: '{"action":"add-time","minutes":90}',

        }),

      )

    })



    it('posts an open-time command with no minutes', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await editPcTime(7, { action: 'open-time' })).toEqual({

        success: true,

        data: undefined,

      })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7/time',

        expect.objectContaining({ method: 'POST', body: '{"action":"open-time"}' }),

      )

    })



    it('posts a time-out command', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await editPcTime(7, { action: 'time-out' })).toEqual({

        success: true,

        data: undefined,

      })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7/time',

        expect.objectContaining({ method: 'POST', body: '{"action":"time-out"}' }),

      )

    })



    it.each([400, 404, 409])('returns the server message on %i', async (status) => {

      stubFetch(Response.json({ error: 'Enter 24 hours or less.' }, { status }))

      expect(await editPcTime(7, { action: 'add-time', minutes: 1500 })).toEqual({

        success: false,

        status,

        error: 'Enter 24 hours or less.',

      })

    })

  })



  describe('shutDownPc', () => {

    it('posts an empty body to the shutdown route of the PC', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await shutDownPc(7)).toEqual({ success: true, data: undefined })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7/shutdown',

        expect.objectContaining({ method: 'POST', body: '{}' }),

      )

    })



    it.each([404, 409])('returns the server message on %i', async (status) => {

      stubFetch(Response.json({ error: 'This PC is already shutting down.' }, { status }))

      expect(await shutDownPc(7)).toEqual({

        success: false,

        status,

        error: 'This PC is already shutting down.',

      })

    })

  })



  describe('rebootPc', () => {

    it('posts an empty body to the reboot route of the PC', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await rebootPc(7)).toEqual({ success: true, data: undefined })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7/reboot',

        expect.objectContaining({ method: 'POST', body: '{}' }),

      )

    })



    it.each([404, 409])('returns the server message on %i', async (status) => {

      stubFetch(Response.json({ error: 'This PC is already restarting.' }, { status }))

      expect(await rebootPc(7)).toEqual({

        success: false,

        status,

        error: 'This PC is already restarting.',

      })

    })

  })



  describe('cancelPcPower', () => {

    it('posts an empty body to the cancel route of the PC', async () => {

      const fetchMock = stubFetch(new Response(null, { status: 204 }))

      expect(await cancelPcPower(7)).toEqual({ success: true, data: undefined })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/7/cancel-power',

        expect.objectContaining({ method: 'POST', body: '{}' }),

      )

    })



    it.each([404, 409])('returns the server message on %i', async (status) => {

      stubFetch(Response.json({ error: 'No shutdown is pending.' }, { status }))

      expect(await cancelPcPower(7)).toEqual({

        success: false,

        status,

        error: 'No shutdown is pending.',

      })

    })

  })



  describe('cancelPcsPower', () => {

    it('posts the PC ids to the cancel route and returns how many were cancelled', async () => {

      const fetchMock = stubFetch(Response.json({ affected: 2 }))

      expect(await cancelPcsPower([3, 7])).toEqual({ success: true, data: { affected: 2 } })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/cancel-power',

        expect.objectContaining({ method: 'POST', body: '{"ids":[3,7]}' }),

      )

    })



    it('fails when the response has no count', async () => {

      stubFetch(Response.json({ count: 3 }))

      expect(await cancelPcsPower([3])).toMatchObject({

        success: false,

        error: FALLBACK_ERROR_MESSAGE,

      })

    })



    it('returns the server message when the request fails', async () => {

      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))

      expect(await cancelPcsPower([3])).toEqual({

        success: false,

        status: 401,

        error: 'Sign in again.',

      })

    })

  })



  describe('bulkRebootPcs', () => {

    it('posts the PC ids to the reboot route and returns how many were restarted', async () => {

      const fetchMock = stubFetch(Response.json({ affected: 2 }))

      expect(await bulkRebootPcs([3, 7])).toEqual({ success: true, data: { affected: 2 } })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/reboot',

        expect.objectContaining({ method: 'POST', body: '{"ids":[3,7]}' }),

      )

    })



    it('fails when the response has no count', async () => {

      stubFetch(Response.json({ count: 3 }))

      expect(await bulkRebootPcs([3])).toMatchObject({

        success: false,

        error: FALLBACK_ERROR_MESSAGE,

      })

    })



    it('returns the server message when the request fails', async () => {

      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))

      expect(await bulkRebootPcs([3])).toEqual({

        success: false,

        status: 401,

        error: 'Sign in again.',

      })

    })

  })



  describe('bulkShutDownPcs', () => {

    it('posts the PC ids to the shutdown route and returns how many were shut down', async () => {

      const fetchMock = stubFetch(Response.json({ affected: 2 }))

      expect(await bulkShutDownPcs([3, 7])).toEqual({ success: true, data: { affected: 2 } })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/shutdown',

        expect.objectContaining({ method: 'POST', body: '{"ids":[3,7]}' }),

      )

    })



    it('fails when the response has no count', async () => {

      stubFetch(Response.json({ count: 3 }))

      expect(await bulkShutDownPcs([3])).toMatchObject({

        success: false,

        error: FALLBACK_ERROR_MESSAGE,

      })

    })



    it('returns the server message when the request fails', async () => {

      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))

      expect(await bulkShutDownPcs([3])).toEqual({

        success: false,

        status: 401,

        error: 'Sign in again.',

      })

    })

  })



  describe('bulkLockPcs and bulkUnlockPcs', () => {

    it('posts the PC ids and message to the lock route and returns how many were locked', async () => {

      const fetchMock = stubFetch(Response.json({ affected: 2 }))

      expect(await bulkLockPcs([3, 7], 'Class is over.')).toEqual({ success: true, data: { affected: 2 } })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/lock',

        expect.objectContaining({ method: 'POST', body: '{"ids":[3,7],"message":"Class is over."}' }),

      )

    })



    it('posts the PC ids to the unlock route and returns how many were unlocked', async () => {

      const fetchMock = stubFetch(Response.json({ affected: 0 }))

      expect(await bulkUnlockPcs([3])).toEqual({ success: true, data: { affected: 0 } })

      expect(fetchMock).toHaveBeenCalledWith(

        '/api/pcs/unlock',

        expect.objectContaining({ method: 'POST', body: '{"ids":[3]}' }),

      )

    })



    it('posts a null message when no custom message was typed', async () => {
      const fetchMock = stubFetch(Response.json({ affected: 2 }))
      expect(await bulkLockPcs([3, 7], null)).toEqual({ success: true, data: { affected: 2 } })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/lock',
        expect.objectContaining({ method: 'POST', body: '{"ids":[3,7],"message":null}' }),
      )
    })

    it('fails on a count that is not a whole number of PCs', async () => {

      stubFetch(Response.json({ affected: -1 }))

      expect(await bulkUnlockPcs([3])).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it('fails when the response has no count', async () => {

      stubFetch(Response.json({ count: 3 }))

      expect(await bulkLockPcs([3], null)).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })

    })



    it('returns the server message when the request fails', async () => {

      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))

      expect(await bulkLockPcs([3], null)).toEqual({ success: false, status: 401, error: 'Sign in again.' })

    })

  })

})



describe('pcs client update api', () => {

  afterEach(() => {

    vi.unstubAllGlobals()

  })



  const update = { targetVersion: '0.20.0', state: 'pending', error: null }



  it('keeps the reported client version and queued update', async () => {

    stubFetch(Response.json([{ ...serverPc, clientVersion: '0.19.0', clientUpdate: update }]))

    expect(await listPcs()).toEqual({

      success: true,

      data: [{ ...serverPc, clientVersion: '0.19.0', clientUpdate: update }],

    })

  })



  it('reads a PC from an older server as not reported and no update', async () => {

    const { clientVersion: _version, clientUpdate: _update, ...olderServerPc } = serverPc

    stubFetch(Response.json([olderServerPc]))

    expect(await listPcs()).toEqual({ success: true, data: [serverPc] })

  })



  it('reads an update state the console does not know as no update, and keeps the PC', async () => {

    stubFetch(Response.json([{ ...serverPc, clientUpdate: { ...update, state: 'done' } }]))

    expect(await listPcs()).toEqual({

      success: true,

      data: [{ ...serverPc, clientUpdate: null }],

    })

  })



  it('reads an odd client version as not reported, and keeps the rest of the list', async () => {

    stubFetch(Response.json([{ ...serverPc, clientVersion: 'v0.19' }, { ...serverPc, id: 4 }]))

    expect(await listPcs()).toEqual({

      success: true,

      data: [serverPc, { ...serverPc, id: 4 }],

    })

  })



  it('cleans the error text of a failed update, and caps its length', async () => {

    const failed = { ...update, state: 'failed', error: `Disk\u0000full\u202E  ${'x'.repeat(300)}` }
    stubFetch(Response.json([{ ...serverPc, clientUpdate: failed }]))

    const result = await listPcs()

    if (!result.success) throw new Error('expected the list to parse')

    expect(result.data[0].clientUpdate?.error).toMatch(/^Disk full +x+$/)

    expect(result.data[0].clientUpdate?.error).toHaveLength(200)

  })



  it('queues an update for the listed PCs with the version the admin saw', async () => {

    const fetchMock = stubFetch(Response.json({ affected: 2 }))

    expect(await queuePcsClientUpdate([3, 4], '0.20.0')).toEqual({ success: true, data: { affected: 2 } })

    expect(fetchMock).toHaveBeenCalledWith(

      '/api/pcs/client-update',

      expect.objectContaining({

        method: 'POST',

        body: JSON.stringify({ pcIds: [3, 4], version: '0.20.0' }),

      }),

    )

  })



  it('sends more than 500 PCs in batches and adds up what the server affected', async () => {

    const fetchMock = vi.fn((_url: string, init: RequestInit) => {

      const { pcIds } = JSON.parse(String(init.body)) as { pcIds: number[] }

      return Promise.resolve(Response.json({ affected: pcIds.length }))

    })

    vi.stubGlobal('fetch', fetchMock)

    const pcIds = Array.from({ length: 1200 }, (_value, index) => index + 1)



    expect(await queuePcsClientUpdate(pcIds, '0.20.0')).toEqual({

      success: true,

      data: { affected: 1200 },

    })

    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)).pcIds.length)).toEqual([

      500, 500, 200,

    ])

  })



  it('stops at the first failed batch and returns its error', async () => {

    let call = 0

    vi.stubGlobal(

      'fetch',

      vi.fn(() => {

        call++

        return Promise.resolve(

          call === 1

            ? Response.json({ affected: 500 })

            : Response.json({ error: 'The uploaded update changed. Check the version and try again.' }, { status: 409 }),

        )

      }),

    )

    const pcIds = Array.from({ length: 900 }, (_value, index) => index + 1)



    expect(await queuePcsClientUpdate(pcIds, '0.20.0')).toEqual({

      success: false,

      status: 409,

      error: 'The uploaded update changed. Check the version and try again.',

    })

    expect(call).toBe(2)

  })



  it('shows the server message when no installer is uploaded', async () => {

    stubFetch(Response.json({ error: 'Upload a client installer first.' }, { status: 409 }))

    expect(await queuePcsClientUpdate([3], '0.20.0')).toEqual({

      success: false,

      status: 409,

      error: 'Upload a client installer first.',

    })

  })



  it('cancels the update for the listed PCs', async () => {

    const fetchMock = stubFetch(Response.json({ affected: 1 }))

    expect(await cancelPcsClientUpdate([7])).toEqual({ success: true, data: { affected: 1 } })

    expect(fetchMock).toHaveBeenCalledWith(

      '/api/pcs/client-update/cancel',

      expect.objectContaining({ method: 'POST', body: JSON.stringify({ pcIds: [7] }) }),

    )

  })

})

