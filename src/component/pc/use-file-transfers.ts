import { useEffect, useRef, useState } from 'react'
import { hasPendingTransfers, mergeTransfers } from '../../lib/file-transfers'
import { startPollLoop } from '../../lib/poll-loop'
import { decideFileTransfers, getFileTransfers } from '../../lib/shared-files-api'
import type { FileTransfer, FileTransferDecision } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'

export const FILE_TRANSFER_POLL_INTERVAL_MS = 2_000

const POLL_ERROR_MESSAGE = "Can't refresh the status right now. Trying again."

// Polls while any transfer can still change, and stops once all are final or the caller unmounts.
export function useFileTransfers(initialTransfers: FileTransfer[]) {
  const request = useSessionRequest()
  const [transfers, setTransfers] = useState(initialTransfers)
  const [pollError, setPollError] = useState<string | null>(null)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [isDeciding, setIsDeciding] = useState(false)
  const isDecidingRef = useRef(false)
  const isPending = hasPendingTransfers(transfers)
  const transferIdsKey = transfers.map((transfer) => transfer.id).join(',')

  useEffect(() => {
    if (!isPending) return
    const transferIds = transferIdsKey.split(',').map(Number)
    const loop = { isFirstRun: true, isActive: true }
    const stopPolling = startPollLoop(async () => {
      // The transfers just arrived when polling starts, so the first run only waits for the next one.
      if (loop.isFirstRun) {
        loop.isFirstRun = false
        return
      }
      const result = await request(getFileTransfers(transferIds, { isBackground: true }))
      if (!loop.isActive) return
      if (result.success) {
        setTransfers((current) => mergeTransfers(current, result.data))
        setPollError(null)
      } else {
        setPollError(POLL_ERROR_MESSAGE)
      }
    }, FILE_TRANSFER_POLL_INTERVAL_MS)
    return () => {
      loop.isActive = false
      stopPolling()
    }
  }, [isPending, transferIdsKey, request])

  async function decide(transferIds: number[], decision: FileTransferDecision) {
    if (isDecidingRef.current) return
    isDecidingRef.current = true
    setIsDeciding(true)
    setDecisionError(null)
    try {
      const result = await request(decideFileTransfers(transferIds, decision))
      if (result.success) setTransfers((current) => mergeTransfers(current, result.data))
      else setDecisionError(result.error)
    } finally {
      isDecidingRef.current = false
      setIsDeciding(false)
    }
  }

  return { transfers, isPending, pollError, decisionError, isDeciding, decide }
}
