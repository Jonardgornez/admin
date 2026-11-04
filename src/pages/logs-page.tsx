import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { LogFiltersForm, type LogFilterDraft } from '../component/log/log-filters-form'
import { PageHeader } from '../component/layout/page-header'
import { Button } from '../component/ui/button'
import { DataTable, type DataTableColumn } from '../component/ui/data-table'
import { Icon } from '../component/ui/icon'
import { sessionLogs } from '../data/logs'
import { filterLogs, formatDuration, formatLogTime, paginate } from '../lib/logs'
import type { SessionLog } from '../types'

const PAGE_SIZE = 10

const INITIAL_FILTERS: LogFilterDraft = { from: '2026-11-01', to: '2026-11-04', pc: '', user: '' }
const EMPTY_FILTERS: LogFilterDraft = { from: '', to: '', pc: '', user: '' }

const columns: DataTableColumn<SessionLog>[] = [
  { key: 'pcName', label: 'PC', isMono: true, render: (log) => log.pcName },
  { key: 'userOrSource', label: 'User or source', render: (log) => log.userOrSource },
  { key: 'startedAt', label: 'Start', render: (log) => formatLogTime(log.startedAt) },
  {
    key: 'endedAt',
    label: 'End',
    render: (log) => (log.endedAt ? formatLogTime(log.endedAt) : 'Running'),
  },
  {
    key: 'duration',
    label: 'Duration',
    align: 'right',
    render: (log) => <span className="tabular-nums">{formatDuration(log.durationMinutes)}</span>,
  },
  { key: 'endedBy', label: 'Ended by', render: (log) => log.endedBy ?? '—' },
]

export function LogsPage() {
  const [searchParams] = useSearchParams()
  const startingFilters = { ...INITIAL_FILTERS, pc: searchParams.get('pc') ?? '' }
  const [draft, setDraft] = useState<LogFilterDraft>(startingFilters)
  const [appliedFilters, setAppliedFilters] = useState<LogFilterDraft>(startingFilters)
  const [requestedPage, setRequestedPage] = useState(1)

  const logPage = paginate(filterLogs(sessionLogs, appliedFilters), requestedPage, PAGE_SIZE)

  function applyFilters() {
    setAppliedFilters(draft)
    setRequestedPage(1)
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setRequestedPage(1)
  }

  return (
    <>
      <PageHeader title="Logs and reports">
        <Button variant="secondary">Purge old logs</Button>
        <Button variant="primary">
          <Icon name="download" />
          Export CSV
        </Button>
      </PageHeader>
      <LogFiltersForm
        draft={draft}
        onDraftChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
        onApply={applyFilters}
        onClear={clearFilters}
      />
      <DataTable
        columns={columns}
        rows={logPage.items}
        getRowKey={(log) => log.id}
        minWidthClassName="min-w-205"
        emptyMessage="No sessions match these filters."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-ink-muted">
          Showing {logPage.firstItem}–{logPage.lastItem} of {logPage.totalItems} sessions · server
          time
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={logPage.page <= 1}
            onClick={() => setRequestedPage(logPage.page - 1)}
          >
            Previous
          </Button>
          <span className="text-ink-muted">
            Page {logPage.page} of {logPage.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={logPage.page >= logPage.totalPages}
            onClick={() => setRequestedPage(logPage.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}
