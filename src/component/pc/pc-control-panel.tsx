import { useId, useState, type RefObject } from 'react'
import { getControlEndMessage, type RemoteControlState } from '../../lib/remote-control'
import type { Pc } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Icon } from '../ui/icon'

const CONTROL_NOTICE = 'The administrator is controlling this PC'
const DEFAULT_DESCRIPTION = 'Use your mouse and keyboard on this PC. The user is always notified.'
const CONTROLLING_DESCRIPTION = 'Your mouse and keyboard control this PC until you stop.'

interface PcControlPanelProps {
  pc: Pc
  control: RemoteControlState
  // Null when Take control is allowed. Otherwise it explains what the admin must change.
  takeControlBlockMessage: string | null
  stopButtonRef: RefObject<HTMLButtonElement | null>
  onStartControl: () => void
  onStopControl: () => void
}

export function PcControlPanel({
  pc,
  control,
  takeControlBlockMessage,
  stopButtonRef,
  onStartControl,
  onStopControl,
}: PcControlPanelProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const descriptionId = useId()
  const endMessage = getControlEndMessage(control)
  const isOn = control.kind === 'on'
  const isRequesting = control.kind === 'requesting'
  const signedInText = pc.user
    ? `${pc.user} is signed in and will be interrupted.`
    : 'No user is signed in.'

  function getDescription(): string {
    if (isOn) return CONTROLLING_DESCRIPTION
    if (isRequesting) return 'Waiting for the PC to confirm.'
    return takeControlBlockMessage ?? DEFAULT_DESCRIPTION
  }

  function confirmControl() {
    setIsConfirming(false)
    onStartControl()
  }

  return (
    <section aria-labelledby="remote-control-title" className="flex flex-col gap-3">
      {isOn && (
        <Banner variant="warning" icon="alert" role="status" title={`Controlling ${pc.name}`}>
          Your mouse and keyboard control this PC. It shows “{CONTROL_NOTICE}” until control ends.
        </Banner>
      )}
      {endMessage && (
        <Banner variant="danger" icon="alert" role="alert" title="Remote control">
          {endMessage}
        </Banner>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-200 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="remote-control-title" className="m-0 text-lg font-semibold">
            Remote control
          </h2>
          <p id={descriptionId} className="m-0 text-sm text-ink-muted">
            {getDescription()}
          </p>
        </div>
        {isOn && (
          <Button ref={stopButtonRef} variant="secondary" onClick={onStopControl}>
            <Icon name="x" />
            Stop control
          </Button>
        )}
        {isRequesting && (
          <Button variant="primary" disabled>
            <Icon name="monitor" />
            Starting control…
          </Button>
        )}
        {!isOn && !isRequesting && (
          <Button
            variant="primary"
            disabled={takeControlBlockMessage !== null}
            aria-describedby={descriptionId}
            onClick={() => setIsConfirming(true)}
          >
            <Icon name="monitor" />
            Take control
          </Button>
        )}
      </div>
      <p role="status" className="sr-only">
        {isRequesting ? 'Starting control…' : ''}
      </p>
      <ConfirmDialog
        isOpen={isConfirming}
        title={`Take control of ${pc.name}?`}
        confirmLabel="Take control"
        confirmVariant="primary"
        onConfirm={confirmControl}
        onCancel={() => setIsConfirming(false)}
      >
        {signedInText} {pc.name} shows “{CONTROL_NOTICE}” until control ends.
      </ConfirmDialog>
    </section>
  )
}
