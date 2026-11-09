import { PageHeader } from '../component/layout/page-header'
import { RequestCard } from '../component/request/request-card'
import { useLoginRequests } from '../component/request/use-login-requests'
import { useConsoleDefaults } from '../component/settings/use-console-defaults'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { DataTable, type DataTableColumn } from '../component/ui/data-table'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import type { ApiResult } from '../lib/api'
import { isSessionExpired } from '../lib/auth-state'
import {
  describeDenyAll,
  formatDecision,
  formatRequestDateTime,
  formatTimeGiven,
} from '../lib/requests'
import type { ApprovalChoice, LoginRequest } from '../types'

const historyColumns: DataTableColumn<LoginRequest>[] = [
  { key: 'pcName', label: 'PC', isMono: true, render: (entry) => entry.pcName },
  {
    key: 'requestedAt',
    label: 'Requested',
    render: (entry) => formatRequestDateTime(entry.requestedAt),
  },
  { key: 'decision', label: 'Decision', render: (entry) => formatDecision(entry) },
  { key: 'time', label: 'Time given', render: (entry) => formatTimeGiven(entry) },
  {
    key: 'decidedAt',
    label: 'Decided',
    render: (entry) => formatRequestDateTime(entry.decidedAt),
  },
]

export function RequestsPage() {
  const notify = useNotify()
  const {
    pending,
    history,
    now,
    loadState,
    busyRequestIds,
    isRefreshing,
    isDenyingAll,
    reload,
    refresh,
    approve,
    deny,
    denyAll,
  } = useLoginRequests()
  const { isLoaded: areDefaultsLoaded, defaults } = useConsoleDefaults()
  // Cards pre-fill from the saved default on mount, so they wait for it.
  const isLoaded = loadState.status === 'loaded' && areDefaultsLoaded
  const isLoading = loadState.status === 'loading' || !areDefaultsLoaded

  // An expired session is handled by the sign-out redirect, so say nothing here.
  function notifyFailure(result: ApiResult<unknown>) {
    if (!result.success && !isSessionExpired(result)) notify(result.error, 'alert')
  }

  // A refused approval is shown on the request's card, so it is not repeated as a toast.
  async function approveRequest(request: LoginRequest, choice: ApprovalChoice) {
    const result = await approve(request, choice)
    if (result.success) notify(`Request from ${request.pcName} approved.`)
    return result
  }

  async function denyRequest(request: LoginRequest) {
    const result = await deny(request)
    if (result.success) notify(`Request from ${request.pcName} denied.`, 'x')
    else notifyFailure(result)
  }

  async function denyAllRequests() {
    const result = await denyAll(pending.map((request) => request.id))
    if (result.success) notify(describeDenyAll(result.data.length), 'x')
    else notifyFailure(result)
  }

  async function refreshRequests() {
    notifyFailure(await refresh())
  }

  return (
    <>
      <PageHeader
        title="Login requests"
        meta={isLoaded && <span className="text-ink-muted">{pending.length} waiting</span>}
      >
        <Button
          variant="secondary"
          disabled={!isLoaded || isRefreshing}
          onClick={() => void refreshRequests()}
        >
          <Icon name="refresh" />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
        <Button
          variant="secondary"
          disabled={!isLoaded || pending.length === 0 || busyRequestIds.length > 0}
          onClick={() => void denyAllRequests()}
        >
          <Icon name="x" />
          {isDenyingAll ? 'Denying...' : 'Deny all'}
        </Button>
      </PageHeader>
      {isLoading && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading login requests...
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner
            variant="danger"
            icon="alert"
            title="Can't load login requests"
            role="alert"
            className="w-full"
          >
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      )}
      {isLoaded && (
        <>
          {pending.length === 0 ? (
            <p className="m-0 rounded-lg border border-border bg-surface-200 p-6 text-center text-ink-muted">
              No requests waiting.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  now={now}
                  isBusy={busyRequestIds.includes(request.id)}
                  defaultApproval={defaults.defaultApproval}
                  onApprove={(choice) => approveRequest(request, choice)}
                  onDeny={() => void denyRequest(request)}
                />
              ))}
            </div>
          )}
          <section aria-labelledby="history-title" className="flex flex-col gap-3">
            <h2 id="history-title" className="m-0 text-xl font-semibold">
              History
            </h2>
            <DataTable
              columns={historyColumns}
              rows={history}
              getRowKey={(entry) => String(entry.id)}
              minWidthClassName="min-w-190"
              emptyMessage="No earlier requests."
            />
          </section>
        </>
      )}
    </>
  )
}
