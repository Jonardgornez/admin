import { useCallback, useEffect, useRef, useState } from 'react'
import * as accountsApi from '../../lib/accounts-api'
import type { AccountPayload } from '../../lib/accounts-api'
import { removeAccount, upsertAccount } from '../../lib/accounts'
import type { ApiResult } from '../../lib/api'
import type { Account } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'

const NOT_FOUND_STATUS = 404

export type AccountsLoadState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; error: string }

export function useAccounts() {
  const request = useSessionRequest()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadState, setLoadState] = useState<AccountsLoadState>({ status: 'loading' })
  const [busyAccountIds, setBusyAccountIds] = useState<number[]>([])
  const latestLoadId = useRef(0)

  const fetchAccounts = useCallback(
    async (isSilent: boolean) => {
      const loadId = ++latestLoadId.current
      const result = await request(accountsApi.listAccounts())
      // A newer load started, so this answer is stale.
      if (loadId !== latestLoadId.current) return
      if (result.success) {
        setAccounts(result.data)
        setLoadState({ status: 'loaded' })
      } else if (!isSilent) {
        setLoadState({ status: 'error', error: result.error })
      }
    },
    [request],
  )

  const reload = useCallback(() => {
    setLoadState({ status: 'loading' })
    return fetchAccounts(false)
  }, [fetchAccounts])

  useEffect(() => {
    void fetchAccounts(false)
  }, [fetchAccounts])

  // A list response requested before a change would undo that change on screen.
  const discardLoadsInFlight = useCallback(() => {
    latestLoadId.current++
  }, [])

  // The account is gone on the server, so refresh the list without a loading flash.
  const refreshIfMissing = useCallback(
    (result: ApiResult<unknown>) => {
      if (!result.success && result.status === NOT_FOUND_STATUS) void fetchAccounts(true)
    },
    [fetchAccounts],
  )

  const saveResult = useCallback(
    async (pending: Promise<ApiResult<Account>>) => {
      const result = await request(pending)
      if (result.success) {
        discardLoadsInFlight()
        setAccounts((current) => upsertAccount(current, result.data))
      }
      refreshIfMissing(result)
      return result
    },
    [request, refreshIfMissing, discardLoadsInFlight],
  )

  const runForAccount = useCallback(
    async <T,>(id: number, action: () => Promise<ApiResult<T>>) => {
      setBusyAccountIds((current) => [...current, id])
      try {
        return await action()
      } finally {
        setBusyAccountIds((current) => current.filter((busyId) => busyId !== id))
      }
    },
    [],
  )

  const createAccount = useCallback(
    (payload: AccountPayload) => saveResult(accountsApi.createAccount(payload)),
    [saveResult],
  )

  const updateAccount = useCallback(
    (id: number, payload: AccountPayload) => saveResult(accountsApi.updateAccount(id, payload)),
    [saveResult],
  )

  const setAccountActive = useCallback(
    (account: Account, isActive: boolean) =>
      runForAccount(account.id, () => saveResult(accountsApi.setAccountActive(account.id, isActive))),
    [runForAccount, saveResult],
  )

  const deleteAccount = useCallback(
    (account: Account) =>
      runForAccount(account.id, async () => {
        const result = await request(accountsApi.deleteAccount(account.id))
        if (result.success) {
          discardLoadsInFlight()
          setAccounts((current) => removeAccount(current, account.id))
        }
        refreshIfMissing(result)
        return result
      }),
    [runForAccount, request, refreshIfMissing, discardLoadsInFlight],
  )

  return {
    accounts,
    loadState,
    busyAccountIds,
    reload,
    createAccount,
    updateAccount,
    setAccountActive,
    deleteAccount,
  }
}
