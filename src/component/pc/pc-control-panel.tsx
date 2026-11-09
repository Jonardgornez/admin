import { useId, useState, type RefObject } from 'react'
import { getControlEndMessage, type RemoteControlState } from '../../lib/remote-control'
import type { Pc, ViewMode } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Icon } from '../ui/icon'

const CONTROL_NOTICE = 'The administrator is controlling this PC'

// What the PC shows while it is controlled. An anonymous view stays silent; a notified view shows the controlling notice.
const CONTROL_TEXT: Record<ViewMode, { idle: string; on: string; confirm: string }> = {
  notified: {
    idle: 'Use your mouse and keyboard on this PC. The user is notified.',
    on: `Your mouse and keyboard control this PC. It shows “${CONTROL_NOTICE}” until control ends.`,
    confirm: `shows “${CONTROL_NOTICE}” until control ends.`,
  },
  anonymous: {
    idle: 'Use your mouse and keyboard on this PC. Anonymous view shows nothing on the PC.',
    on: 'Your mouse and keyboard control this PC. It shows no notice, but the user can see the mouse and typing.',
    confirm: 'shows no notice, but the user can see the mouse move and typing appear.',
  },
}
const CONTROLLING_DESCRIPTION = 'Your mouse and keyboard control this PC until you stop.'
const REQUESTING_DESCRIPTION = 'Starting control… Waiting for the PC to confirm.'

interface PcControlPanelProps {
  pc: Pc
  viewMode: ViewMode
  control: RemoteControlState
  // Null when Take control is allowed. Otherwise it explains what the admin must change.
  takeControlBlockMessage: string | null
  isCoolingDown: boolean
  stopButtonRef: RefObject<HTMLButtonElement | null>
  onStartControl: () => void
  onStopControl: () => void
}

export function PcControlPanel({
  pc,
  viewMode,
  control,
  takeControlBlockMessage,
  isCoolingDown,
  stopButtonRef,
  onStartControl,
  onStopControl,
}: PcControlPanelProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const descriptionId = useId()
  const endMessage = getControlEndMessage(control)
  const isOn = control.kind === 'on'
  const isRequesting = control.kind === 'requesting'
  const controlText = CONTROL_TEXT[viewMode]
  const signedInText = pc.user
    ? `${pc.user} is signed in and will be interrupted.`
    : 'No user is signed in.'

  function getDescription(): string {
    if (isOn) return CONTROLLING_DESCRIPTION
    if (isRequesting) return REQUESTING_DESCRIPTION
    return takeControlBlockMessage ?? controlText.idle
  }

  function confirmControl() {
    setIsConfirming(false)
    onStartControl()
  }

  return (
    <section aria-labelledby="remote-control-title" className="flex flex-col gap-3">
      {isOn && (
        <Banner variant="warning" icon="alert" role="status" title={`Controlling ${pc.name}`}>
          {controlText.on}
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
          <Button variant="secondary" onClick={onStopControl}>
            <Icon name="x" />
            Cancel
          </Button>
        )}
        {!isOn && !isRequesting && (
          <Button
            variant="primary"
            disabled={takeControlBlockMessage !== null || isCoolingDown}
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
        {signedInText} {pc.name} {controlText.confirm}
      </ConfirmDialog>
    </section>
  )
}
