import { useState } from 'react'
import { AccountFormDialog } from '../component/account/account-form-dialog'
import { AccountRowActions } from '../component/account/account-row-actions'
import { AccountStatus } from '../component/account/account-status'
import { PageHeader } from '../component/layout/page-header'
import { Button } from '../component/ui/button'
import { ConfirmDialog } from '../component/ui/confirm-dialog'
import { DataTable, type DataTableColumn } from '../component/ui/data-table'
import { Field, TextInput } from '../component/ui/field'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import { accounts as initialAccounts } from '../data/accounts'
import {
  addAccount,
  deleteAccount,
  filterAccounts,
  formatDefaultTime,
  toggleAccountEnabled,
  updateAccount,
} from '../lib/accounts'
import type { Account, AccountDetails } from '../types'

type AccountFormTarget = { kind: 'add' } | { kind: 'edit'; account: Account }

export function AccountsPage() {
  const notify = useNotify()
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingDeleteUsername, setPendingDeleteUsername] = useState<string | null>(null)
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
      render: (account) => <span className="text-ink-subtle">{account.lastLogin}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (account) => (
        <AccountRowActions
          account={account}
          onEdit={() => setAccountFormTarget({ kind: 'edit', account })}
          onToggleEnabled={() => toggleEnabled(account)}
          onDelete={() => setPendingDeleteUsername(account.username)}
        />
      ),
    },
  ]

  function toggleEnabled(account: Account) {
    setAccounts((current) => toggleAccountEnabled(current, account.username))
    notify(`Account ${account.username} ${account.isActive ? 'disabled' : 'enabled'}.`, 'user')
  }

  function confirmDelete() {
    if (pendingDeleteUsername) {
      setAccounts((current) => deleteAccount(current, pendingDeleteUsername))
      notify(`Account ${pendingDeleteUsername} deleted.`, 'user')
    }
    setPendingDeleteUsername(null)
  }

  function saveAccount(details: AccountDetails) {
    const username = details.username.trim()
    if (accountFormTarget?.kind === 'edit') {
      const originalUsername = accountFormTarget.account.username
      setAccounts((current) => updateAccount(current, originalUsername, details))
      notify(`Account ${username} updated.`, 'user')
    } else {
      setAccounts((current) => addAccount(current, details))
      setSearchQuery('')
      notify(`Account ${username} added.`, 'user')
    }
    setAccountFormTarget(null)
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Accounts can sign in on any PC."
      >
        <Button variant="primary" onClick={() => setAccountFormTarget({ kind: 'add' })}>
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
      <DataTable
        columns={columns}
        rows={filterAccounts(accounts, searchQuery)}
        getRowKey={(account) => account.username}
        minWidthClassName="min-w-190"
        emptyMessage="No accounts match your search."
      />
      {accountFormTarget && (
        <AccountFormDialog
          account={accountFormTarget.kind === 'edit' ? accountFormTarget.account : undefined}
          accounts={accounts}
          onSave={saveAccount}
          onCancel={() => setAccountFormTarget(null)}
        />
      )}
      <ConfirmDialog
        isOpen={pendingDeleteUsername !== null}
        title={`Delete ${pendingDeleteUsername ?? ''}?`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteUsername(null)}
      >
        This removes the account from the list. This cannot be undone.
      </ConfirmDialog>
    </>
  )
}
