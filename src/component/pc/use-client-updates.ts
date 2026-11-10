import { useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import {
  describeClientUpdateCancelResult,
  describeClientUpdateResult,
} from '../../lib/client-updates'
import type { BulkCommandResult } from '../../lib/pcs-api'
import { useClientRelease } from '../settings/use-client-release'
import { useNotify } from '../ui/notification-context'
import type { ClientUpdateTarget } from './client-update-dialog'

type BulkResult = ApiResult<BulkCommandResult> | null

interface UseClientUpdatesOptions {
  queuePcIds: (pcIds: number[], version: string) => Promise<BulkResult>
  cancelPcIds: (pcIds: number[]) => Promise<BulkResult>
}

const CONFLICT_STATUS = 409
const NO_RELEASE_MESSAGE = 'Upload a client installer first.'

// The release loads once when the Dashboard opens, and again each time the Update dialog opens.
export function useClientUpdates({ queuePcIds, cancelPcIds }: UseClientUpdatesOptions) {
  const notify = useNotify()
  const { loadState, refreshRelease } = useClientRelease()
  const release = loadState.status === 'loaded' ? loadState.release : null
  const [updateTarget, setUpdateTarget] = useState<ClientUpdateTarget | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  function closeUpdate() {
    setUpdateTarget(null)
    setUpdateError(null)
  }

  async function openUpdate(pcIds: number[], includesServerPc: boolean) {
    const result = await refreshRelease()
    if (!result.success) {
      if (!isSessionExpired(result)) notify(result.error, 'alert')
      return
    }
    if (result.data === null) {
      notify(NO_RELEASE_MESSAGE, 'alert')
      return
    }
    setUpdateError(null)
    setUpdateTarget({ pcIds, includesServerPc, release: result.data })
  }

  // Null means the same bulk command is still running, which keeps the dialog open.
  async function confirmUpdate(target: ClientUpdateTarget) {
    const result = await queuePcIds(target.pcIds, target.release.version)
    if (!result) return
    if (result.success) {
      closeUpdate()
      notify(describeClientUpdateResult(result.data.affected), 'download')
      return
    }
    if (isSessionExpired(result)) {
      closeUpdate()
      return
    }
    // The upload changed under the admin, so the dialog shows the new release and the message.
    if (result.status === CONFLICT_STATUS) {
      const fresh = await refreshRelease()
      if (fresh.success && fresh.data) {
        setUpdateTarget({ ...target, release: fresh.data })
        setUpdateError(result.error)
        return
      }
    }
    closeUpdate()
    notify(result.error, 'alert')
  }

  async function cancelUpdates(pcIds: number[]) {
    const result = await cancelPcIds(pcIds)
    if (!result) return
    if (result.success) notify(describeClientUpdateCancelResult(result.data.affected), 'x')
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  return {
    release,
    updateTarget,
    updateError,
    openUpdate,
    closeUpdate,
    confirmUpdate,
    cancelUpdates,
  }
}
