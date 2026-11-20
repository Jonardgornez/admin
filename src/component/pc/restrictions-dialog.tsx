import { useId, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { restrictionPolicies, driveLetters } from '../../data/restrictions'
import {
  getInternetChoice,
  getPcIdsToSetInternet,
  SERVER_PC_INTERNET_NOTE,
  type InternetChoice,
} from '../../lib/internet'
import type { InternetResult } from '../../lib/internet-api'
import type { BulkCommandResult } from '../../lib/pcs-api'
import {
  getCommonRestrictions,
  getFastUserSwitchingChoice,
  getPcIdsToSetFastUserSwitching,
  type FastUserSwitchingChoice,
} from '../../lib/restrictions'
import type { RegisteredPc } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Modal } from '../ui/modal'
import { CheckboxGroup } from './checkbox-group'

const FAST_USER_SWITCH_POLICY_ID = 'fast-user-switch'

interface RestrictionsDialogProps {
  targetPcs: RegisteredPc[]
  // Null means the same bulk command is still running.
  onApplyInternet: (
    pcIds: number[],
    blocked: boolean,
  ) => Promise<ApiResult<InternetResult[]> | null>
  onApplyFastUserSwitching: (
    pcIds: number[],
    disabled: boolean,
  ) => Promise<ApiResult<BulkCommandResult> | null>
  onClose: () => void
}

// Fast User Switching has its own working checkbox, so it is left out of the read-only list.
const policyOptions = restrictionPolicies
  .filter((policy) => policy.id !== FAST_USER_SWITCH_POLICY_ID)
  .map((policy) => ({
    value: policy.id,
    label: policy.needsReboot ? `${policy.label} (*)` : policy.label,
  }))

const driveOptions = driveLetters.map((letter) => ({ value: letter, label: letter }))

// A failed or still-running command stops the rest, so the dialog stays open with what went wrong.
function getFailure(result: ApiResult<unknown> | null): string | null | undefined {
  if (!result) return undefined
  return result.success ? null : result.error
}

// Internet and Fast User Switching apply; the other policy and drive options are read-only until they can.
export function RestrictionsDialog({
  targetPcs,
  onApplyInternet,
  onApplyFastUserSwitching,
  onClose,
}: RestrictionsDialogProps) {
  const titleId = useId()
  const internetHelpId = useId()
  const switchingHelpId = useId()
  const listedPcs = targetPcs.filter((pc) => !pc.isServerPc)
  const hasServerPc = targetPcs.some((pc) => pc.isServerPc)
  const currentRestrictions = getCommonRestrictions(listedPcs)
  const initialInternetChoice = getInternetChoice(listedPcs)
  const initialSwitchingChoice = getFastUserSwitchingChoice(listedPcs)
  const [internetChoice, setInternetChoice] = useState<InternetChoice>(initialInternetChoice)
  const [switchingChoice, setSwitchingChoice] =
    useState<FastUserSwitchingChoice>(initialSwitchingChoice)
  const [isApplying, setIsApplying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasInternetChange =
    internetChoice !== 'mixed' && internetChoice !== initialInternetChoice
  const hasSwitchingChange =
    switchingChoice !== 'mixed' && switchingChoice !== initialSwitchingChoice

  async function applyInternet(): Promise<string | null | undefined> {
    if (!hasInternetChange) return null
    const blocked = internetChoice === 'blocked'
    return getFailure(await onApplyInternet(getPcIdsToSetInternet(listedPcs, blocked), blocked))
  }

  async function applyFastUserSwitching(): Promise<string | null | undefined> {
    if (!hasSwitchingChange) return null
    const disabled = switchingChoice === 'disabled'
    const pcIds = getPcIdsToSetFastUserSwitching(listedPcs, disabled)
    return getFailure(await onApplyFastUserSwitching(pcIds, disabled))
  }

  async function applyChanges() {
    if (!hasInternetChange && !hasSwitchingChange) {
      onClose()
      return
    }
    setIsApplying(true)
    setErrorMessage(null)
    let failure = await applyInternet()
    if (failure === null) failure = await applyFastUserSwitching()
    setIsApplying(false)
    if (failure === null) onClose()
    else if (failure) setErrorMessage(failure)
  }

  return (
    <Modal isOpen size="lg" labelledBy={titleId} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="m-0 text-xl font-semibold">
          Restrictions
        </h2>
        <p className="m-0">
          <span className="font-semibold">To: </span>
          <span className="font-mono text-sm">{listedPcs.map((pc) => pc.name).join(', ')}</span>
        </p>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
            Internet
          </legend>
          <label className="flex items-center gap-2 text-ink">
            <Checkbox
              ref={(checkbox) => {
                if (checkbox) checkbox.indeterminate = internetChoice === 'mixed'
              }}
              checked={internetChoice === 'blocked'}
              disabled={isApplying}
              aria-describedby={internetHelpId}
              onChange={(event) => setInternetChoice(event.target.checked ? 'blocked' : 'open')}
            />
            Block internet
          </label>
          <p id={internetHelpId} className="m-0 text-sm text-ink-muted">
            Blocked PCs can still reach the Lykantra server and the lab network.
          </p>
          {hasServerPc && <p className="m-0 text-sm text-ink-muted">{SERVER_PC_INTERNET_NOTE}</p>}
        </fieldset>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
            Sign-in
          </legend>
          <label className="flex items-center gap-2 text-ink">
            <Checkbox
              ref={(checkbox) => {
                if (checkbox) checkbox.indeterminate = switchingChoice === 'mixed'
              }}
              checked={switchingChoice === 'disabled'}
              disabled={isApplying}
              aria-describedby={switchingHelpId}
              onChange={(event) => setSwitchingChoice(event.target.checked ? 'disabled' : 'allowed')}
            />
            Disable Fast User Switch
          </label>
          <p id={switchingHelpId} className="m-0 text-sm text-ink-muted">
            Hides &quot;Switch user&quot;, so a student can&apos;t leave the Lykantra session for
            another account. Offline PCs apply it when they start. Needs client 0.29.0 or newer.
          </p>
        </fieldset>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CheckboxGroup
            legend="Policies"
            options={policyOptions}
            selectedValues={currentRestrictions.policies}
            disabled
          />
          <CheckboxGroup
            legend="Hide Drives (*)"
            options={driveOptions}
            selectedValues={currentRestrictions.hiddenDrives}
            className="grid grid-cols-2"
            disabled
          />
          <CheckboxGroup
            legend="Disable Drives (*)"
            options={driveOptions}
            selectedValues={currentRestrictions.disabledDrives}
            className="grid grid-cols-2"
            disabled
          />
        </div>
        <label className="flex items-center gap-2 text-ink">
          <Checkbox disabled />
          Apply without restarting computer
        </label>
        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <p className="m-0">The other policies and drives aren&apos;t available yet.</p>
          <p className="m-0">
            OK applies Internet and Fast User Switching to every PC listed above.
          </p>
          <p className="m-0">* It may require rebooting the computer.</p>
        </div>
        {errorMessage && (
          <Banner variant="danger" icon="alert" role="alert">
            {errorMessage}
          </Banner>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={isApplying} onClick={() => void applyChanges()}>
            OK
          </Button>
        </div>
      </div>
    </Modal>
  )
}
