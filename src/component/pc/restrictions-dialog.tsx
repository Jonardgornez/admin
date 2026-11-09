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
import { getCommonRestrictions } from '../../lib/restrictions'
import type { RegisteredPc } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Modal } from '../ui/modal'
import { CheckboxGroup } from './checkbox-group'

interface RestrictionsDialogProps {
  targetPcs: RegisteredPc[]
  onApplyInternet: (
    pcIds: number[],
    blocked: boolean,
  ) => Promise<ApiResult<InternetResult[]> | null>
  onClose: () => void
}

const policyOptions = restrictionPolicies.map((policy) => ({
  value: policy.id,
  label: policy.needsReboot ? `${policy.label} (*)` : policy.label,
}))

const driveOptions = driveLetters.map((letter) => ({ value: letter, label: letter }))

// The policy and drive options are read-only until they can be applied.
export function RestrictionsDialog({ targetPcs, onApplyInternet, onClose }: RestrictionsDialogProps) {
  const titleId = useId()
  const internetHelpId = useId()
  const listedPcs = targetPcs.filter((pc) => !pc.isServerPc)
  const hasServerPc = targetPcs.some((pc) => pc.isServerPc)
  const currentRestrictions = getCommonRestrictions(listedPcs)
  const initialInternetChoice = getInternetChoice(listedPcs)
  const [internetChoice, setInternetChoice] = useState<InternetChoice>(initialInternetChoice)
  const [isApplying, setIsApplying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasInternetChange =
    internetChoice !== 'mixed' && internetChoice !== initialInternetChoice

  // Null means the same bulk command is still running, so the dialog stays open until it ends.
  async function applyInternetChoice() {
    if (!hasInternetChange) {
      onClose()
      return
    }
    const blocked = internetChoice === 'blocked'
    setIsApplying(true)
    setErrorMessage(null)
    const result = await onApplyInternet(getPcIdsToSetInternet(listedPcs, blocked), blocked)
    setIsApplying(false)
    if (result && !result.success) setErrorMessage(result.error)
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
          <p className="m-0">These restrictions aren&apos;t available yet.</p>
          <p className="m-0">OK applies the Internet setting to every PC listed above.</p>
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
          <Button variant="primary" disabled={isApplying} onClick={() => void applyInternetChoice()}>
            OK
          </Button>
        </div>
      </div>
    </Modal>
  )
}
