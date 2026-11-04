import { useId, useState } from 'react'
import { restrictionPolicies, driveLetters } from '../../data/restrictions'
import { isPcOff } from '../../lib/pcs'
import { getCommonRestrictions } from '../../lib/restrictions'
import type { Pc, PcRestrictions } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Checkbox, RadioOption } from '../ui/choice'
import { Modal } from '../ui/modal'
import { CheckboxGroup } from './checkbox-group'

type RestrictionTarget = 'selected' | 'all'

interface RestrictionsDialogProps {
  pcs: Pc[]
  initialSelectedNames: string[]
  onApply: (
    pcNames: string[],
    restrictions: PcRestrictions,
    appliesWithoutRestart: boolean,
  ) => void
  onCancel: () => void
}

const policyOptions = restrictionPolicies.map((policy) => ({
  value: policy.id,
  label: policy.needsReboot ? `${policy.label} (*)` : policy.label,
}))

const driveOptions = driveLetters.map((letter) => ({ value: letter, label: letter }))

export function RestrictionsDialog({
  pcs,
  initialSelectedNames,
  onApply,
  onCancel,
}: RestrictionsDialogProps) {
  const titleId = useId()
  const targetName = useId()
  const [restrictions, setRestrictions] = useState<PcRestrictions>(() =>
    getCommonRestrictions(pcs.filter((pc) => initialSelectedNames.includes(pc.name))),
  )
  const [selectedNames, setSelectedNames] = useState<string[]>(initialSelectedNames)
  const [target, setTarget] = useState<RestrictionTarget>('selected')
  const [appliesWithoutRestart, setAppliesWithoutRestart] = useState(false)

  const pcOptions = pcs.map((pc) => ({
    value: pc.name,
    label: pc.name,
    description: isPcOff(pc) ? 'Offline' : undefined,
  }))
  const isTargetEmpty = target === 'selected' && selectedNames.length === 0

  function applyRestrictions() {
    const pcNames = target === 'all' ? pcs.map((pc) => pc.name) : selectedNames
    onApply(pcNames, restrictions, appliesWithoutRestart)
  }

  return (
    <Modal isOpen size="lg" labelledBy={titleId} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="m-0 text-xl font-semibold">
          Restrictions
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <CheckboxGroup
            legend="Policies"
            options={policyOptions}
            selectedValues={restrictions.policies}
            onChange={(policies) => setRestrictions((current) => ({ ...current, policies }))}
          />
          <CheckboxGroup
            legend="Hide Drives (*)"
            options={driveOptions}
            selectedValues={restrictions.hiddenDrives}
            className="grid grid-cols-2"
            onChange={(hiddenDrives) =>
              setRestrictions((current) => ({ ...current, hiddenDrives }))
            }
          />
          <CheckboxGroup
            legend="Disable Drives (*)"
            options={driveOptions}
            selectedValues={restrictions.disabledDrives}
            className="grid grid-cols-2"
            onChange={(disabledDrives) =>
              setRestrictions((current) => ({ ...current, disabledDrives }))
            }
          />
          <div className="flex min-w-0 flex-col gap-4">
            <CheckboxGroup
              legend="Computers"
              options={pcOptions}
              selectedValues={selectedNames}
              isDisabled={target === 'all'}
              className="max-h-64 overflow-y-auto"
              onChange={setSelectedNames}
            />
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
                Apply to
              </legend>
              <RadioOption
                name={targetName}
                value="selected"
                checked={target === 'selected'}
                onChange={() => setTarget('selected')}
              >
                Selected
              </RadioOption>
              <RadioOption
                name={targetName}
                value="all"
                checked={target === 'all'}
                onChange={() => setTarget('all')}
              >
                All
              </RadioOption>
            </fieldset>
          </div>
        </div>
        {restrictions.disabledDrives.includes('C') && (
          <Banner variant="warning" icon="alert">
            Disabling drive C, the system drive, can stop Windows from working properly.
          </Banner>
        )}
        <label className="flex items-center gap-2 text-ink">
          <Checkbox
            checked={appliesWithoutRestart}
            onChange={(event) => setAppliesWithoutRestart(event.target.checked)}
          />
          Apply without restarting computer
        </label>
        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <p className="m-0">OK replaces the restrictions on every targeted PC.</p>
          <p className="m-0">* It may require rebooting the computer.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={isTargetEmpty} onClick={applyRestrictions}>
            OK
          </Button>
        </div>
      </div>
    </Modal>
  )
}
