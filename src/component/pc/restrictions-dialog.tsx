import { useId, useState } from 'react'
import { restrictionPolicies, driveLetters } from '../../data/restrictions'
import { getCommonRestrictions } from '../../lib/restrictions'
import type { Pc, PcRestrictions } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Modal } from '../ui/modal'
import { CheckboxGroup } from './checkbox-group'

interface RestrictionsDialogProps {
  targetPcs: Pc[]
  onApply: (restrictions: PcRestrictions, appliesWithoutRestart: boolean) => void
  onCancel: () => void
}

const policyOptions = restrictionPolicies.map((policy) => ({
  value: policy.id,
  label: policy.needsReboot ? `${policy.label} (*)` : policy.label,
}))

const driveOptions = driveLetters.map((letter) => ({ value: letter, label: letter }))

export function RestrictionsDialog({ targetPcs, onApply, onCancel }: RestrictionsDialogProps) {
  const titleId = useId()
  const [restrictions, setRestrictions] = useState<PcRestrictions>(() =>
    getCommonRestrictions(targetPcs),
  )
  const [appliesWithoutRestart, setAppliesWithoutRestart] = useState(false)

  return (
    <Modal isOpen size="lg" labelledBy={titleId} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="m-0 text-xl font-semibold">
          Restrictions
        </h2>
        <p className="m-0">
          <span className="font-semibold">To: </span>
          <span className="font-mono text-sm">
            {targetPcs.map((pc) => pc.name).join(', ')}
          </span>
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
          <p className="m-0">OK replaces the restrictions on every PC listed above.</p>
          <p className="m-0">* It may require rebooting the computer.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onApply(restrictions, appliesWithoutRestart)}>
            OK
          </Button>
        </div>
      </div>
    </Modal>
  )
}
