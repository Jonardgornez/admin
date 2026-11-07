import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import {
  canCancelPcPower,
  canEditPcTime,
  canRebootPc,
  canShutDownPc,
  getLockToggleTarget,
  isPcOnline,
  toSortedRegisteredPcs,
} from '../../lib/pcs'
import * as pcsApi from '../../lib/pcs-api'
import { sendPcMessage, type PcMessageDelivery } from '../../lib/messages-api'
import type { BulkCommandResult } from '../../lib/pcs-api'
import type { Pc, PcLockAction, PcTimeCommand, RegisteredPc, ServerPc } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'

export const POLL_INTERVAL_MS = 5000
const NOT_FOUND_STATUS = 404
const CONFLICT_STATUS = 409

export type PcsLoadState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; error: string }

type PcsResult = ApiResult<ServerPc[]>

export function usePcs() {
  const request = useSessionRequest()
  const [pcs, setPcs] = useState<RegisteredPc[]>([])
  const [loadState, setLoadState] = useState<PcsLoadState>({ status: 'loading' })
  const [isDisconnected, setIsDisconnected] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [removingPcIds, setRemovingPcIds] = useState<number[]>([])
  const [lockingPcIds, setLockingPcIds] = useState<number[]>([])
  const [timeEditingPcIds, setTimeEditingPcIds] = useState<number[]>([])
  const [powerPendingPcIds, setPowerPendingPcIds] = useState<number[]>([])
  const latestLoadId = useRef(0)
  const hasLoaded = useRef(false)
  // Checked synchronously so a double click cannot send the command twice.
  const lockingPcIdsInFlight = useRef(new Set<number>())
  const timeEditingPcIdsInFlight = useRef(new Set<number>())
  const powerPcIdsInFlight = useRef(new Set<number>())
  const [isBulkCommandBusy, setIsBulkCommandBusy] = useState(false)
  const isBulkCommandInFlight = useRef(false)
  const refreshNow = useRef<((isBackground: boolean) => Promise<void>) | null>(null)

  // Resolves with null when a newer load or a removal started since, so the answer is stale.
  const fetchPcs = useCallback(
    async (isBackground: boolean): Promise<PcsResult | null> => {
      const loadId = ++latestLoadId.current
      const result = await request(pcsApi.listPcs({ isBackground }))
      return loadId === latestLoadId.current ? result : null
    },
    [request],
  )

  const applyResult = useCallback((result: PcsResult | null) => {
    if (!result) return
    if (result.success) {
      hasLoaded.current = true
      const now = new Date()
      setPcs(toSortedRegisteredPcs(result.data, now))
      setLoadState({ status: 'loaded' })
      setIsDisconnected(false)
      setLastUpdatedAt(now)
      return
    }
    // An expired session is handled by the sign-out redirect.
    if (isSessionExpired(result)) return
    if (hasLoaded.current) setIsDisconnected(true)
    else setLoadState({ status: 'error', error: result.error })
  }, [])

  // One request at a time: the next poll is only scheduled once the last response is in.
  useEffect(() => {
    const loop = {
      isStopped: false,
      inFlightCount: 0,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    }

    function scheduleNextPoll() {
      clearTimeout(loop.timer)
      if (loop.isStopped || document.hidden || loop.inFlightCount > 0) return
      loop.timer = setTimeout(() => void refresh(true), POLL_INTERVAL_MS)
    }

    async function refresh(isBackground: boolean) {
      clearTimeout(loop.timer)
      loop.inFlightCount++
      try {
        const result = await fetchPcs(isBackground)
        if (!loop.isStopped) applyResult(result)
      } finally {
        loop.inFlightCount--
        scheduleNextPoll()
      }
    }

    function refreshWhenVisible() {
      if (!document.hidden && loop.inFlightCount === 0) void refresh(true)
    }

    refreshNow.current = refresh
    document.addEventListener('visibilitychange', refreshWhenVisible)
    // The first load counts as activity; polls after it must not extend the session.
    void refresh(hasLoaded.current)

    return () => {
      loop.isStopped = true
      clearTimeout(loop.timer)
      refreshNow.current = null
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [fetchPcs, applyResult])

  const retry = useCallback(() => {
    setLoadState((current) => (current.status === 'error' ? { status: 'loading' } : current))
    void refreshNow.current?.(false)
  }, [])

  const removePc = useCallback(
    async (pc: RegisteredPc): Promise<ApiResult<undefined>> => {
      setRemovingPcIds((current) => [...current, pc.id])
      try {
        const result = await request(pcsApi.removePc(pc.id))
        if (result.success) {
          // A list requested before the removal would bring the PC back.
          latestLoadId.current++
          setPcs((current) => current.filter((candidate) => candidate.id !== pc.id))
        } else if (result.status === NOT_FOUND_STATUS || result.status === CONFLICT_STATUS) {
          void refreshNow.current?.(true)
        }
        return result
      } finally {
        setRemovingPcIds((current) => current.filter((id) => id !== pc.id))
      }
    },
    [request],
  )

  // Runs a command, then re-reads the list so the Dashboard shows what the server reports.
  const runPcCommand = useCallback(
    async <T,>(pending: Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
      const result = await request(pending)
      // A list requested before the command would show the PC's old state.
      latestLoadId.current++
      void refreshNow.current?.(false)
      return result
    },
    [request],
  )

  // Resolves with null when the PC is offline or a lock command for it is already running.
  const runPcLockCommand = useCallback(
    async (pc: RegisteredPc, action: PcLockAction): Promise<ApiResult<undefined> | null> => {
      if (!isPcOnline(pc) || lockingPcIdsInFlight.current.has(pc.id)) return null
      lockingPcIdsInFlight.current.add(pc.id)
      setLockingPcIds((current) => [...current, pc.id])
      try {
        const command = action === 'lock' ? pcsApi.lockPc(pc.id) : pcsApi.unlockPc(pc.id)
        return await runPcCommand(command)
      } finally {
        lockingPcIdsInFlight.current.delete(pc.id)
        setLockingPcIds((current) => current.filter((id) => id !== pc.id))
      }
    },
    [runPcCommand],
  )

  const lockPc = useCallback(
    (pc: RegisteredPc) => runPcLockCommand(pc, 'lock'),
    [runPcLockCommand],
  )

  const unlockPc = useCallback(
    (pc: RegisteredPc) => runPcLockCommand(pc, 'unlock'),
    [runPcLockCommand],
  )

  const togglePcLock = useCallback(
    (pc: RegisteredPc) => runPcLockCommand(pc, getLockToggleTarget(pc)),
    [runPcLockCommand],
  )

  // Resolves with null when the PC has no running session or a time edit for it is already running.
  const editPcTime = useCallback(
    async (pc: RegisteredPc, command: PcTimeCommand): Promise<ApiResult<undefined> | null> => {
      if (!canEditPcTime(pc) || timeEditingPcIdsInFlight.current.has(pc.id)) return null
      timeEditingPcIdsInFlight.current.add(pc.id)
      setTimeEditingPcIds((current) => [...current, pc.id])
      try {
        return await runPcCommand(pcsApi.editPcTime(pc.id, command))
      } finally {
        timeEditingPcIdsInFlight.current.delete(pc.id)
        setTimeEditingPcIds((current) => current.filter((id) => id !== pc.id))
      }
    },
    [runPcCommand],
  )

  // Resolves with null when the PC cannot take the command or another shutdown, reboot or cancel of it is running.
  const runPcPowerCommand = useCallback(
    async (
      pc: RegisteredPc,
      canRunOnPc: (candidate: Pc) => boolean,
      sendCommand: () => Promise<ApiResult<undefined>>,
    ): Promise<ApiResult<undefined> | null> => {
      if (!canRunOnPc(pc) || powerPcIdsInFlight.current.has(pc.id)) return null
      powerPcIdsInFlight.current.add(pc.id)
      setPowerPendingPcIds((current) => [...current, pc.id])
      try {
        return await runPcCommand(sendCommand())
      } finally {
        powerPcIdsInFlight.current.delete(pc.id)
        setPowerPendingPcIds((current) => current.filter((id) => id !== pc.id))
      }
    },
    [runPcCommand],
  )

  const shutDownPc = useCallback(
    (pc: RegisteredPc) =>
      runPcPowerCommand(pc, canShutDownPc, () => pcsApi.shutDownPc(pc.id)),
    [runPcPowerCommand],
  )

  const rebootPc = useCallback(
    (pc: RegisteredPc) => runPcPowerCommand(pc, canRebootPc, () => pcsApi.rebootPc(pc.id)),
    [runPcPowerCommand],
  )

  const cancelPcPower = useCallback(
    (pc: RegisteredPc) =>
      runPcPowerCommand(pc, canCancelPcPower, () => pcsApi.cancelPcPower(pc.id)),
    [runPcPowerCommand],
  )

  // Resolves with null when a bulk lock, unlock, shutdown, reboot or cancel is already running.
  const runBulkCommand = useCallback(
    async (command: () => Promise<ApiResult<BulkCommandResult>>) => {
      if (isBulkCommandInFlight.current) return null
      isBulkCommandInFlight.current = true
      setIsBulkCommandBusy(true)
      try {
        return await runPcCommand(command())
      } finally {
        isBulkCommandInFlight.current = false
        setIsBulkCommandBusy(false)
      }
    },
    [runPcCommand],
  )

  const lockPcs = useCallback(
    (pcIds: number[]) => runBulkCommand(() => pcsApi.bulkLockPcs(pcIds)),
    [runBulkCommand],
  )

  const unlockPcs = useCallback(
    (pcIds: number[]) => runBulkCommand(() => pcsApi.bulkUnlockPcs(pcIds)),
    [runBulkCommand],
  )

  const shutDownPcs = useCallback(
    (pcIds: number[]) => runBulkCommand(() => pcsApi.bulkShutDownPcs(pcIds)),
    [runBulkCommand],
  )

  const rebootPcs = useCallback(
    (pcIds: number[]) => runBulkCommand(() => pcsApi.bulkRebootPcs(pcIds)),
    [runBulkCommand],
  )

  const cancelPcsPower = useCallback(
    (pcIds: number[]) => runBulkCommand(() => pcsApi.cancelPcsPower(pcIds)),
    [runBulkCommand],
  )

  // Messages do not change a PC's state, so the list is not re-read afterwards.
  const sendMessage = useCallback(
    (pcIds: number[], text: string): Promise<ApiResult<PcMessageDelivery[]>> =>
      request(sendPcMessage(pcIds, text)),
    [request],
  )

  return {
    pcs,
    loadState,
    isDisconnected,
    lastUpdatedAt,
    removingPcIds,
    lockingPcIds,
    timeEditingPcIds,
    powerPendingPcIds,
    isBulkCommandBusy,
    retry,
    removePc,
    lockPc,
    unlockPc,
    togglePcLock,
    editPcTime,
    lockPcs,
    unlockPcs,
    shutDownPc,
    shutDownPcs,
    rebootPc,
    rebootPcs,
    cancelPcPower,
    cancelPcsPower,
    sendMessage,
  }
}
