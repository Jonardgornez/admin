import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useSessionRequest } from '../component/auth/use-session-request'
import { BackToDashboardLink } from '../component/layout/back-link'
import { PageHeader } from '../component/layout/page-header'
import { LogFiltersForm, type LogFilterDraft } from '../component/log/log-filters-form'
import { PurgeLogsDialog } from '../component/log/purge-logs-dialog'
import { usePcOptions, type PcOption } from '../component/log/use-pc-options'
import { useSessionLogs, type SessionLogQuery } from '../component/log/use-session-logs'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { DataTable, type DataTableColumn } from '../component/ui/data-table'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import { Pagination } from '../component/ui/pagination'
import { isSessionExpired } from '../lib/auth-state'
import {
  describeEndReason,
  formatDuration,
  formatLogTime,
  formatSessionCount,
  getLogDateRange,
  readPcFromSearchParams,
  toDayValue,
  toMonthValue,
  type LogFilters,
} from '../lib/logs'
import { EXPORT_ROW_LIMIT, exportSessionLogs } from '../lib/session-logs-api'
import type { SessionLog } from '../types'

const columns: DataTableColumn<SessionLog>[] = [
  { key: 'pcName', label: 'PC', isMono: true, render: (log) => log.pcName },
  { key: 'userOrSource', label: 'User or source', render: (log) => log.userOrSource },
  { key: 'startedAt', label: 'Start', render: (log) => formatLogTime(log.startedAt) },
  {
    key: 'endedAt',
    label: 'End',
    render: (log) => (log.endedAt === null ? '—' : formatLogTime(log.endedAt)),
  },
  {
    key: 'duration',
    label: 'Duration',
    align: 'right',
    render: (log) => <span className="tabular-nums">{formatDuration(log.durationMinutes)}</span>,
  },
  { key: 'endReason', label: 'End reason', render: (log) => describeEndReason(log) },
]

// All time and every PC. The day and month pickers start on today, ready for when Show changes.
function createDraft(pcId = ''): LogFilterDraft {
  const today = new Date()
  return { period: { kind: 'all', day: toDayValue(today), month: toMonthValue(today) }, pcId, user: '' }
}

function toLogFilters(draft: LogFilterDraft): LogFilters {
  return {
    ...getLogDateRange(draft.period),
    user: draft.user,
    pcId: draft.pcId === '' ? undefined : Number(draft.pcId),
  }
}

// A PC opened from View history may have been removed since; it stays choosable under the name the link gave.
function withLinkedPc(options: PcOption[], linkedPc: PcOption | null): PcOption[] {
  if (!linkedPc || options.some((pc) => pc.id === linkedPc.id)) return options
  return [...options, linkedPc]
}

export function LogsPage() {
  const notify = useNotify()
  const request = useSessionRequest()
  const [searchParams, setSearchParams] = useSearchParams()
  const [linkedPc] = useState(() => readPcFromSearchParams(searchParams))
  const [cameFromDashboard] = useState(() => searchParams.has('pcId'))
  const [draft, setDraft] = useState(() => createDraft(linkedPc ? String(linkedPc.id) : ''))
  const [query, setQuery] = useState<SessionLogQuery>(() => ({ filters: toLogFilters(draft), page: 1 }))
  const { data, loadState, reload } = useSessionLogs(query)
  const pcOptions = withLinkedPc(usePcOptions(), linkedPc)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportTruncated, setIsExportTruncated] = useState(false)
  const [isPurgeOpen, setIsPurgeOpen] = useState(false)

  function applyFilters() {
    setQuery({ filters: toLogFilters(draft), page: 1 })
  }

  // The link's PC leaves the address too, so a reload after Clear shows every PC.
  function clearFilters() {
    const cleared = createDraft()
    setDraft(cleared)
    setQuery({ filters: toLogFilters(cleared), page: 1 })
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('pcId')
        next.delete('pcName')
        return next
      },
      { replace: true },
    )
  }

  function goToPage(page: number) {
    setQuery((current) => ({ ...current, page }))
  }

  // An expired session is handled by the sign-out redirect, so say nothing here.
  async function exportCsv() {
    setIsExporting(true)
    setIsExportTruncated(false)
    const result = await request(exportSessionLogs(query.filters))
    setIsExporting(false)
    if (result.success) setIsExportTruncated(result.data.isTruncated)
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  function finishPurge(deleted: number) {
    setIsPurgeOpen(false)
    notify(`Deleted ${formatSessionCount(deleted)}.`)
    void reload()
  }

  const isLoading = loadState.status === 'loading'

  return (
    <>
      {cameFromDashboard && <BackToDashboardLink />}
      <PageHeader title="Logs and reports">
        <Button variant="secondary" onClick={() => setIsPurgeOpen(true)}>
          Purge old logs
        </Button>
        <Button variant="primary" disabled={isExporting} onClick={() => void exportCsv()}>
          <Icon name="download" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </PageHeader>
      <LogFiltersForm
        draft={draft}
        pcOptions={pcOptions}
        onDraftChange={setDraft}
        onApply={applyFilters}
        onClear={clearFilters}
      />
      {isExportTruncated && (
        <Banner
          variant="info"
          icon="info"
          role="status"
          onDismiss={() => setIsExportTruncated(false)}
        >
          Exported the newest {EXPORT_ROW_LIMIT.toLocaleString('en-US')} sessions.
        </Banner>
      )}
      {isLoading && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading sessions...
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner
            variant="danger"
            icon="alert"
            title="Can't load sessions"
            role="alert"
            className="w-full"
          >
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      )}
      {data && loadState.status === 'loaded' && (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            getRowKey={(log) => String(log.id)}
            minWidthClassName="min-w-205"
            emptyMessage="No sessions match these filters."
          />
          <Pagination page={data} itemLabel="sessions" note="server time" onPageChange={goToPage} />
        </>
      )}
      {isPurgeOpen && (
        <PurgeLogsDialog onPurged={finishPurge} onClose={() => setIsPurgeOpen(false)} />
      )}
    </>
  )
}
