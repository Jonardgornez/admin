import { useState } from 'react'
import { AccountRowActions } from '../component/account/account-row-actions'
import { AccountStatus } from '../component/account/account-status'
import { PageHeader } from '../component/layout/page-header'
import { Button } from '../component/ui/button'
import { ConfirmDialog } from '../component/ui/confirm-dialog'
import { DataTable, type DataTableColumn } from '../component/ui/data-table'
import { Field, TextInput } from '../component/ui/field'
import { Icon } from '../component/ui/icon'
import { accounts as initialAccounts } from '../data/accounts'
import { deleteAccount, filterAccounts, toggleAccountEnabled } from '../lib/accounts'
import type { Account } from '../types'

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingDeleteUsername, setPendingDeleteUsername] = useState<string | null>(null)

  const columns: DataTableColumn<Account>[] = [
    { key: 'username', label: 'Username', isMono: true, render: (account) => account.username },
    { key: 'assignedPc', label: 'Assigned PC', isMono: true, render: (account) => account.assignedPc },
    {
      key: 'canUseAnyPc',
      label: 'Use on any PC',
      render: (account) => (account.canUseAnyPc ? 'Yes' : 'No'),
    },
    { key: 'status', label: 'Status', render: (account) => <AccountStatus isActive={account.isActive} /> },
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
          onToggleEnabled={() => setAccounts((current) => toggleAccountEnabled(current, account.username))}
          onDelete={() => setPendingDeleteUsername(account.username)}
        />
      ),
    },
  ]

  function confirmDelete() {
    if (pendingDeleteUsername) {
      setAccounts((current) => deleteAccount(current, pendingDeleteUsername))
    }
    setPendingDeleteUsername(null)
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        description="An account works only on its PC unless you allow any PC."
      >
        <Button variant="primary">
          <Icon name="user" />
          Add account
        </Button>
      </PageHeader>
      <Field label="Search" htmlFor="account-search" className="w-full sm:w-70">
        <TextInput
          id="account-search"
          value={searchQuery}
          placeholder="Username or PC"
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
      <p className="m-0 text-xs text-ink-subtle">
        Reset password sets a new one; the old password cannot be shown.
      </p>
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
