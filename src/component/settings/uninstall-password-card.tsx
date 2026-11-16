import { useState } from 'react'
import { isSessionExpired } from '../../lib/auth-state'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Icon } from '../ui/icon'
import { useNotify } from '../ui/notification-context'
import { SettingsCard } from './settings-card'
import { UninstallPasswordForm } from './uninstall-password-form'
import { useUninstallPassword } from './use-uninstall-password'

const UNINSTALL_PASSWORD_HINT =
  "Students must enter this password to uninstall Lykantra Client. PCs get the change at their next check-in; only PCs on client 0.24.0 or later are protected. Use a long password you don't use anywhere else — each PC keeps a hash of it. A student with administrator rights can still remove the client by other means."

export function UninstallPasswordCard() {
  const notify = useNotify()
  const { loadState, retry, isClearing, savePassword, clearPassword } = useUninstallPassword()
  const [isConfirmingClear, setIsConfirmingClear] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  async function handleClear() {
    setIsConfirmingClear(false)
    setClearError(null)
    const result = await clearPassword()
    if (!result) return
    if (result.success) {
      notify('Uninstall password cleared.')
    } else if (!isSessionExpired(result)) {
      setClearError(result.error)
    }
  }

  return (
    <SettingsCard title="Uninstall password">
      <p className="m-0 text-sm text-ink-muted">{UNINSTALL_PASSWORD_HINT}</p>

      {loadState.status === 'loading' && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading uninstall password...
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner
            variant="danger"
            icon="alert"
            title="Can't load the uninstall password"
            role="alert"
            className="w-full"
          >
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={retry}>
            <Icon name="refresh" />
            Retry
          </Button>
        </div>
      )}
      {loadState.status === 'loaded' && (
        <div className="flex flex-col gap-5">
          <p className="m-0 flex items-center gap-2 text-base">
            <Icon name={loadState.isSet ? 'lock' : 'unlock'} />
            <span>
              Status: <strong>{loadState.isSet ? 'Set' : 'Not set'}</strong>
            </span>
          </p>
          <UninstallPasswordForm isDisabled={isClearing} onSave={savePassword} />
          {loadState.isSet && (
            <div className="flex flex-col items-start gap-3">
              <Button
                variant="danger"
                onClick={() => setIsConfirmingClear(true)}
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear password'}
              </Button>
              {clearError && (
                <Banner variant="danger" icon="alert" role="alert" className="w-full">
                  {clearError}
                </Banner>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmingClear}
        title="Clear the uninstall password?"
        confirmLabel="Clear password"
        onConfirm={() => void handleClear()}
        onCancel={() => setIsConfirmingClear(false)}
      >
        Students will be able to uninstall Lykantra Client without a password once their PC
        checks in.
      </ConfirmDialog>
    </SettingsCard>
  )
}
