import { useState } from 'react'
import { PageHeader } from '../component/layout/page-header'
import { PcBulkToolbar } from '../component/pc/pc-bulk-toolbar'
import { PcDetailDialog } from '../component/pc/pc-detail-dialog'
import { PcGrid } from '../component/pc/pc-grid'
import { RemovePcDialog } from '../component/pc/remove-pc-dialog'
import { usePcs } from '../component/pc/use-pcs'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import { isSessionExpired } from '../lib/auth-state'
import { countOnlinePcs, filterPcs, formatLastUpdate } from '../lib/pcs'
import type { RegisteredPc } from '../types'

const COMMANDS_NOTE = "Other PC commands aren't connected yet."
const NO_PCS_MESSAGE =
  'No PCs registered yet. Install the client on a PC and register it to see it here.'

export function DashboardPage() {
  const notify = useNotify()
  const {
    pcs,
    loadState,
    isDisconnected,
    lastUpdatedAt,
    removingPcIds,
    lockingPcIds,
    retry,
    removePc,
    togglePcLock,
  } = usePcs()
  const [detailPcName, setDetailPcName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pcToRemove, setPcToRemove] = useState<RegisteredPc | null>(null)

  const isLoaded = loadState.status === 'loaded'
  const detailPc = pcs.find((pc) => pc.name === detailPcName)
  const visiblePcs = filterPcs(pcs, searchQuery)

  function isRemoveDisabled(pcName: string): boolean {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    return isDisconnected || (pc !== undefined && removingPcIds.includes(pc.id))
  }

  function isLockDisabled(pcName: string): boolean {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    return isDisconnected || (pc !== undefined && lockingPcIds.includes(pc.id))
  }

  async function toggleLockOfPc(pc: RegisteredPc) {
    const result = await togglePcLock(pc)
    if (!result) return
    const isLocking = pc.status === 'in-use'
    const outcome = isLocking ? 'locked' : 'unlocked'
    if (result.success) notify(`${pc.name} ${outcome}.`, isLocking ? 'lock' : 'unlock')
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  function toggleLockOfPcNamed(pcName: string) {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    if (pc) void toggleLockOfPc(pc)
  }

  async function removeConfirmedPc(pc: RegisteredPc) {
    setPcToRemove(null)
    const result = await removePc(pc)
    if (result.success) notify(`${pc.name} removed.`, 'x')
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  return (
    <>
      <div className="flex flex-col gap-6 md:sticky md:top-0 md:z-10 md:-mt-6 md:bg-surface-100 md:pt-6">
        <PageHeader
          title="Dashboard"
          meta={
            isLoaded && (
              <span className="text-ink-muted">
                {isDisconnected && lastUpdatedAt
                  ? `Last update ${formatLastUpdate(lastUpdatedAt)}`
                  : `${countOnlinePcs(pcs)} of ${pcs.length} PCs online`}
              </span>
            )
          }
        >
          {isDisconnected && (
            <Button variant="secondary" onClick={retry}>
              <Icon name="refresh" />
              Retry now
            </Button>
          )}
        </PageHeader>

        {isDisconnected && (
          <Banner variant="danger" icon="alert" role="alert" title="Disconnected">
            The console lost its connection to the server. The statuses below are the last known
            values. Reconnecting automatically…
          </Banner>
        )}

        {isLoaded && pcs.length > 0 && (
          <PcBulkToolbar
            hasVisiblePcs={visiblePcs.length > 0}
            areCommandsDisabled
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            note={COMMANDS_NOTE}
          />
        )}
      </div>

      {loadState.status === 'loading' && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading PCs...
        </p>
      )}

      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner
            variant="danger"
            icon="alert"
            title="Can't load PCs"
            role="alert"
            className="w-full"
          >
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      {isLoaded && pcs.length === 0 && (
        <p className="m-0 rounded-lg border border-border bg-surface-200 p-6 text-center text-ink-muted">
          {NO_PCS_MESSAGE}
        </p>
      )}

      {isLoaded && pcs.length > 0 && (
        <PcGrid
          pcs={visiblePcs}
          areCommandsDisabled
          emptyMessage={`No PCs match "${searchQuery}".`}
          isLockDisabled={isLockDisabled}
          isRemoveDisabled={isRemoveDisabled}
          onOpenDetail={setDetailPcName}
          onToggleLock={toggleLockOfPcNamed}
          onRemove={(pcName) => setPcToRemove(pcs.find((pc) => pc.name === pcName) ?? null)}
        />
      )}

      {detailPc && (
        <PcDetailDialog
          pc={detailPc}
          areCommandsDisabled
          isLockDisabled={isLockDisabled(detailPc.name)}
          onClose={() => setDetailPcName(null)}
          onToggleLock={() => void toggleLockOfPc(detailPc)}
        />
      )}

      <RemovePcDialog
        pc={pcToRemove}
        onConfirm={() => pcToRemove && void removeConfirmedPc(pcToRemove)}
        onCancel={() => setPcToRemove(null)}
      />
    </>
  )
}
