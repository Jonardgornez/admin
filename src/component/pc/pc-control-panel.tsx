import { useState } from 'react'
import { isPcActionable } from '../../lib/pcs'
import type { Pc } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Icon } from '../ui/icon'

const CONTROL_NOTICE = 'The administrator is controlling this PC'

interface PcControlPanelProps {
  pc: Pc
  isControlling: boolean
  onStartControl: () => void
  onStopControl: () => void
}

export function PcControlPanel({
  pc,
  isControlling,
  onStartControl,
  onStopControl,
}: PcControlPanelProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const canControl = isPcActionable(pc)
  const signedInText = pc.user
    ? `${pc.user} is signed in and will be interrupted.`
    : 'No user is signed in.'

  function confirmControl() {
    setIsConfirming(false)
    onStartControl()
  }

  return (
    <section aria-labelledby="remote-control-title" className="flex flex-col gap-3">
      {isControlling && (
        <Banner variant="warning" icon="alert" role="status" title={`Controlling ${pc.name}`}>
          Your mouse and keyboard control this PC. It shows “{CONTROL_NOTICE}” until you stop.
        </Banner>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-200 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="remote-control-title" className="m-0 text-lg font-semibold">
            Remote control
          </h2>
          <p className="m-0 text-sm text-ink-muted">
            {canControl
              ? 'Use your mouse and keyboard on this PC. The user is always notified.'
              : 'Remote control is unavailable while this PC is off or rebooting.'}
          </p>
        </div>
        {isControlling ? (
          <Button variant="secondary" onClick={onStopControl}>
            <Icon name="x" />
            Stop control
          </Button>
        ) : (
          <Button variant="primary" disabled={!canControl} onClick={() => setIsConfirming(true)}>
            <Icon name="monitor" />
            Take control
          </Button>
        )}
      </div>
      <ConfirmDialog
        isOpen={isConfirming}
        title={`Take control of ${pc.name}?`}
        confirmLabel="Take control"
        confirmVariant="primary"
        onConfirm={confirmControl}
        onCancel={() => setIsConfirming(false)}
      >
        {signedInText} {pc.name} shows “{CONTROL_NOTICE}” until you stop.
      </ConfirmDialog>
    </section>
  )
}
