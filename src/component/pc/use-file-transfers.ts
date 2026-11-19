import { useEffect, useRef, useState } from 'react'
import { hasPendingTransfers, mergeTransfers } from '../../lib/file-transfers'
import { startPollLoop } from '../../lib/poll-loop'
import type { ApiResult } from '../../lib/api'
import {
  cancelFileTransfers,
  decideFileTransfers,
  getFileTransfers,
} from '../../lib/shared-files-api'
import type { FileTransfer, FileTransferDecision } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'

export const FILE_TRANSFER_POLL_INTERVAL_MS = 2_000

const POLL_ERROR_MESSAGE = "Can't refresh the status right now. Trying again."

// Polls while any transfer can still change, and stops once all are final or the caller unmounts.
export function useFileTransfers(initialTransfers: FileTransfer[]) {
  const request = useSessionRequest()
  const [transfers, setTransfers] = useState(initialTransfers)
  const [pollError, setPollError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const isPostingRef = useRef(false)
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

  // One action at a time, so a decision and a cancel can't race each other.
  async function postAction(send: () => Promise<ApiResult<FileTransfer[]>>) {
    if (isPostingRef.current) return
    isPostingRef.current = true
    setIsPosting(true)
    setActionError(null)
    try {
      const result = await request(send())
      if (result.success) setTransfers((current) => mergeTransfers(current, result.data))
      else setActionError(result.error)
    } finally {
      isPostingRef.current = false
      setIsPosting(false)
    }
  }

  function decide(transferIds: number[], decision: FileTransferDecision) {
    return postAction(() => decideFileTransfers(transferIds, decision))
  }

  function cancel(transferIds: number[]) {
    return postAction(() => cancelFileTransfers(transferIds))
  }

  return { transfers, isPending, pollError, actionError, isPosting, decide, cancel }
}
