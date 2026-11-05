import { useState } from 'react'
import { AccountFormDialog } from '../component/account/account-form-dialog'
import { AccountRowActions } from '../component/account/account-row-actions'
import { AccountStatus } from '../component/account/account-status'
import { useAccounts } from '../component/account/use-accounts'
import { PageHeader } from '../component/layout/page-header'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { ConfirmDialog } from '../component/ui/confirm-dialog'
import { DataTable, type DataTableColumn } from '../component/ui/data-table'
import { Field, TextInput } from '../component/ui/field'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import type { AccountPayload } from '../lib/accounts-api'
import { filterAccounts, formatDefaultTime, formatLastLogin } from '../lib/accounts'
import type { ApiResult } from '../lib/api'
import { isSessionExpired } from '../lib/auth-state'
import type { Account } from '../types'

type AccountFormTarget = { kind: 'add' } | { kind: 'edit'; account: Account }

const NOT_FOUND_STATUS = 404

export function AccountsPage() {
  const notify = useNotify()
  const {
    accounts,
    loadState,
    busyAccountIds,
    reload,
    createAccount,
    updateAccount,
    setAccountActive,
    deleteAccount,
  } = useAccounts()
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)
  const [accountFormTarget, setAccountFormTarget] = useState<AccountFormTarget | null>(null)

  const columns: DataTableColumn<Account>[] = [
    { key: 'username', label: 'Username', isMono: true, render: (account) => account.username },
    { key: 'status', label: 'Status', render: (account) => <AccountStatus isActive={account.isActive} /> },
    {
      key: 'defaultTime',
      label: 'Default time',
      render: (account) => formatDefaultTime(account.defaultTime),
    },
    {
      key: 'lastLogin',
      label: 'Last login',
      render: (account) => <span className="text-ink-subtle">{formatLastLogin(account.lastLoginAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (account) => (
        <AccountRowActions
          account={account}
          isBusy={busyAccountIds.includes(account.id)}
          onEdit={() => setAccountFormTarget({ kind: 'edit', account })}
          onToggleEnabled={() => void toggleEnabled(account)}
          onDelete={() => setPendingDelete(account)}
        />
      ),
    },
  ]

  // An expired session is handled by the sign-out redirect, so say nothing here.
  function notifyFailure(result: ApiResult<unknown>) {
    if (!result.success && !isSessionExpired(result)) notify(result.error, 'alert')
  }

  async function toggleEnabled(account: Account) {
    const result = await setAccountActive(account, !account.isActive)
    if (result.success) {
      notify(`Account ${result.data.username} ${result.data.isActive ? 'enabled' : 'disabled'}.`, 'user')
    } else {
      notifyFailure(result)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const account = pendingDelete
    setPendingDelete(null)
    const result = await deleteAccount(account)
    if (result.success) notify(`Account ${account.username} deleted.`, 'user')
    else notifyFailure(result)
  }

  async function saveAccount(payload: AccountPayload) {
    const result =
      accountFormTarget?.kind === 'edit'
        ? await updateAccount(accountFormTarget.account.id, payload)
        : await createAccount(payload)
    if (result.success) {
      if (accountFormTarget?.kind === 'add') setSearchQuery('')
      notify(
        `Account ${result.data.username} ${accountFormTarget?.kind === 'edit' ? 'updated' : 'added'}.`,
        'user',
      )
      setAccountFormTarget(null)
    } else if (result.status === NOT_FOUND_STATUS) {
      notify(result.error, 'alert')
      setAccountFormTarget(null)
    }
    return result
  }

  const visibleAccounts = filterAccounts(accounts, searchQuery)
  const emptyMessage =
    accounts.length === 0
      ? 'No accounts yet. Add one to get started.'
      : 'No accounts match your search.'

  return (
    <>
      <PageHeader title="Accounts" description="Accounts can sign in on any PC.">
        <Button
          variant="primary"
          disabled={loadState.status !== 'loaded'}
          onClick={() => setAccountFormTarget({ kind: 'add' })}
        >
          <Icon name="user" />
          Add account
        </Button>
      </PageHeader>
      <Field label="Search" htmlFor="account-search" className="w-full sm:w-70">
        <TextInput
          id="account-search"
          value={searchQuery}
          placeholder="Username"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </Field>
      {loadState.status === 'loading' && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading accounts...
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner variant="danger" icon="alert" title="Can't load accounts" role="alert" className="w-full">
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      )}
      {loadState.status === 'loaded' && (
        <DataTable
          columns={columns}
          rows={visibleAccounts}
          getRowKey={(account) => String(account.id)}
          minWidthClassName="min-w-190"
          emptyMessage={emptyMessage}
        />
      )}
      {accountFormTarget && (
        <AccountFormDialog
          account={accountFormTarget.kind === 'edit' ? accountFormTarget.account : undefined}
          onSave={saveAccount}
          onCancel={() => setAccountFormTarget(null)}
        />
      )}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Delete ${pendingDelete?.username ?? ''}?`}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      >
        This permanently deletes the account. This cannot be undone.
      </ConfirmDialog>
    </>
  )
}
