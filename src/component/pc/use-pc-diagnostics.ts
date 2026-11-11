import { useEffect, useState } from 'react'
import { nextDiagnosticsState, type PcDiagnosticsState } from '../../lib/diagnostics'
import { getPcDiagnostics } from '../../lib/diagnostics-api'
import { startPollLoop } from '../../lib/poll-loop'
import { useSessionRequest } from '../auth/use-session-request'

export const DIAGNOSTICS_POLL_INTERVAL_MS = 15_000

// Polls while the PC's details are open. Unmounting the caller stops the polling.
export function usePcDiagnostics(pcId: number): PcDiagnosticsState {
  const request = useSessionRequest()
  const [state, setState] = useState<PcDiagnosticsState>({ status: 'loading' })

  useEffect(() => {
    const loop = { isFirstRun: true, isActive: true }
    const stopPolling = startPollLoop(async () => {
      // Only the first read counts as activity. Background polls must not extend the idle session.
      const isBackground = !loop.isFirstRun
      loop.isFirstRun = false
      const result = await request(getPcDiagnostics(pcId, { isBackground }))
      const now = new Date()
      if (loop.isActive) setState((current) => nextDiagnosticsState(current, result, now))
    }, DIAGNOSTICS_POLL_INTERVAL_MS)
    return () => {
      loop.isActive = false
      stopPolling()
    }
  }, [pcId, request])

  return state
}
