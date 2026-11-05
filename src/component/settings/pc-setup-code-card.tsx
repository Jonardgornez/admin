import { useCallback, useEffect, useRef, useState } from 'react'
import { isSessionExpired } from '../../lib/auth-state'
import { getSetupCode, regenerateSetupCode } from '../../lib/setup-code-api'
import { useSessionRequest } from '../auth/use-session-request'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Icon } from '../ui/icon'
import { useNotify } from '../ui/notification-context'
import { SettingsCard } from './settings-card'

type SetupCodeState =
  | { status: 'loading' }
  | { status: 'loaded'; code: string }
  | { status: 'error'; error: string }

const COPIED_MESSAGE = 'Setup code copied.'
const COPY_FAILED_MESSAGE = "Couldn't copy the code. Select it and copy it by hand."

export function PcSetupCodeCard() {
  const request = useSessionRequest()
  const notify = useNotify()
  const [state, setState] = useState<SetupCodeState>({ status: 'loading' })
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const isRegeneratingRef = useRef(false)
  const latestLoadId = useRef(0)

  const load = useCallback(async () => {
    const loadId = ++latestLoadId.current
    const result = await request(getSetupCode())
    // A newer load or a new code arrived, so this answer is stale.
    if (loadId !== latestLoadId.current) return
    setState(
      result.success
        ? { status: 'loaded', code: result.data.code }
        : { status: 'error', error: result.error },
    )
  }, [request])

  useEffect(() => {
    void load()
  }, [load])

  function retryLoad() {
    setState({ status: 'loading' })
    void load()
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      notify(COPIED_MESSAGE)
    } catch {
      // Also covers a missing clipboard, where navigator.clipboard is undefined.
      notify(COPY_FAILED_MESSAGE)
    }
  }

  async function createNewCode() {
    if (isRegeneratingRef.current) return
    isRegeneratingRef.current = true
    setIsRegenerating(true)
    try {
      const result = await request(regenerateSetupCode())
      setIsConfirmOpen(false)
      if (result.success) {
        latestLoadId.current++
        setState({ status: 'loaded', code: result.data.code })
        notify('New setup code created.')
      } else if (!isSessionExpired(result)) {
        notify(result.error)
      }
    } finally {
      isRegeneratingRef.current = false
      setIsRegenerating(false)
    }
  }

  return (
    <SettingsCard title="PC setup code">
      <p className="m-0 text-base text-ink-muted">
        Enter this code in the Lykantra client when registering a PC. Treat it like a password:
        anyone who has it can register a PC.
      </p>

      {state.status === 'loading' && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading setup code...
        </p>
      )}

      {state.status === 'error' && (
        <>
          <Banner variant="danger" icon="alert" role="alert">
            {state.error}
          </Banner>
          <div>
            <Button variant="secondary" onClick={retryLoad}>
              <Icon name="refresh" />
              Retry
            </Button>
          </div>
        </>
      )}

      {state.status === 'loaded' && (
        <>
          <code
            aria-label="PC setup code"
            className="block rounded-md border border-border-strong bg-surface-300 px-3 py-2 font-mono text-lg font-semibold tracking-wider break-all select-all"
          >
            {state.code}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void copyCode(state.code)}>
              Copy
            </Button>
            <Button
              variant="secondary"
              disabled={isRegenerating}
              onClick={() => setIsConfirmOpen(true)}
            >
              New code
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Create a new setup code?"
        confirmLabel={isRegenerating ? 'Creating...' : 'Create new code'}
        confirmVariant="primary"
        isConfirmDisabled={isRegenerating}
        onConfirm={() => void createNewCode()}
        onCancel={() => setIsConfirmOpen(false)}
      >
        The old code stops working for new registrations. PCs that are already registered are not
        affected.
      </ConfirmDialog>
    </SettingsCard>
  )
}
