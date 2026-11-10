import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useSessionRequest } from '../component/auth/use-session-request'
import { BackToDashboardLink } from '../component/layout/back-link'
import { PageHeader } from '../component/layout/page-header'
import { LogFiltersForm, type LogFilterDraft } from '../component/log/log-filters-form'
import { SessionLogPagination } from '../component/log/session-log-pagination'
import { useSessionLogs, type SessionLogQuery } from '../component/log/use-session-logs'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { DataTable, type DataTableColumn } from '../component/ui/data-table'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import { isSessionExpired } from '../lib/auth-state'
import { describeEndReason, formatDuration, formatLogTime } from '../lib/logs'
import { EXPORT_ROW_LIMIT, exportSessionLogs } from '../lib/session-logs-api'
import type { SessionLog } from '../types'

const EMPTY_FILTERS: LogFilterDraft = { from: '', to: '', pc: '', user: '' }
const PURGE_HINT_ID = 'purge-logs-hint'

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

export function LogsPage() {
  const notify = useNotify()
  const request = useSessionRequest()
  const [searchParams] = useSearchParams()
  const startingFilters = { ...EMPTY_FILTERS, pc: searchParams.get('pc') ?? '' }
  const [draft, setDraft] = useState<LogFilterDraft>(startingFilters)
  const [query, setQuery] = useState<SessionLogQuery>({ filters: startingFilters, page: 1 })
  const { data, loadState, reload } = useSessionLogs(query)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportTruncated, setIsExportTruncated] = useState(false)

  function applyFilters() {
    setQuery({ filters: draft, page: 1 })
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS)
    setQuery({ filters: EMPTY_FILTERS, page: 1 })
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

  const isLoading = loadState.status === 'loading'

  return (
    <>
      {searchParams.has('pc') && <BackToDashboardLink />}
      <PageHeader title="Logs and reports">
        <span id={PURGE_HINT_ID} className="sr-only">
          Not available yet
        </span>
        <Button
          variant="secondary"
          disabled
          title="Not available yet"
          aria-describedby={PURGE_HINT_ID}
        >
          Purge old logs
        </Button>
        <Button variant="primary" disabled={isExporting} onClick={() => void exportCsv()}>
          <Icon name="download" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </PageHeader>
      <LogFiltersForm
        draft={draft}
        onDraftChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
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
          <SessionLogPagination page={data} onPageChange={goToPage} />
        </>
      )}
    </>
  )
}
