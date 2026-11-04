import { useState } from 'react'
import { PageHeader } from '../component/layout/page-header'
import { RequestCard } from '../component/request/request-card'
import { Button } from '../component/ui/button'
import { DataTable, type DataTableColumn } from '../component/ui/data-table'
import { Icon } from '../component/ui/icon'
import { loginRequests, requestHistory } from '../data/requests'
import { buildApprovedEntry, buildDeniedEntry } from '../lib/requests'
import type { ApprovalChoice, LoginRequest, RequestHistoryEntry } from '../types'

const historyColumns: DataTableColumn<RequestHistoryEntry>[] = [
  { key: 'pcName', label: 'PC', isMono: true, render: (entry) => entry.pcName },
  { key: 'requestedAt', label: 'Requested', render: (entry) => entry.requestedAt },
  { key: 'decision', label: 'Decision', render: (entry) => entry.decision },
  { key: 'session', label: 'Session', render: (entry) => entry.session },
]

export function RequestsPage() {
  const [requests, setRequests] = useState<LoginRequest[]>(loginRequests)
  const [history, setHistory] = useState<RequestHistoryEntry[]>(requestHistory)

  function approve(request: LoginRequest, approval: ApprovalChoice) {
    setRequests((current) => current.filter((item) => item.id !== request.id))
    setHistory((current) => [buildApprovedEntry(request, approval), ...current])
  }

  function deny(request: LoginRequest) {
    setRequests((current) => current.filter((item) => item.id !== request.id))
    setHistory((current) => [buildDeniedEntry(request), ...current])
  }

  function denyAll() {
    setHistory((current) => [...requests.map(buildDeniedEntry), ...current])
    setRequests([])
  }

  return (
    <>
      <PageHeader
        title="Login requests"
        meta={<span className="text-ink-muted">{requests.length} waiting</span>}
      >
        <Button variant="secondary" disabled={requests.length === 0} onClick={denyAll}>
          <Icon name="x" />
          Deny all
        </Button>
      </PageHeader>
      {requests.length === 0 ? (
        <p className="m-0 rounded-lg border border-border bg-surface-200 p-6 text-center text-ink-muted">
          No requests waiting.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onApprove={(approval) => approve(request, approval)}
              onDeny={() => deny(request)}
            />
          ))}
        </div>
      )}
      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="m-0 text-xl font-semibold">
          Earlier today
        </h2>
        <DataTable
          columns={historyColumns}
          rows={history}
          getRowKey={(entry) => entry.id}
          minWidthClassName="min-w-160"
          emptyMessage="No earlier requests."
        />
        <p className="m-0 text-xs text-ink-subtle">
          Each PC can send one request per minute. The default approval mode is set in Settings.
        </p>
      </section>
    </>
  )
}
