import { useId, useState, type ReactNode } from 'react'
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
  emptyRestrictions,
  getCheckChanges,
  getCheckStates,
  getPcIdsToSetRestriction,
  getRestrictionChoice,
  type CheckStates,
  type RestrictionChoice,
  type RestrictionFlag,
} from '../../lib/restrictions'
import {
  DRIVE_LETTERS,
  USER_POLICY_IDS,
  type PcRestrictions,
  type PcRestrictionsChange,
  type RegisteredPc,
  type RestrictionPolicyId,
  type UserPolicyId,
} from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Modal } from '../ui/modal'
import { CheckboxGroup, type CheckboxGroupOption } from './checkbox-group'

// These policies have their own checkboxes above the grid, so they are left out of it.
const OWN_SECTION_POLICY_IDS: RestrictionPolicyId[] = ['fast-user-switch', 'task-manager']
const NOT_BUILT_POLICY_ID = 'file-folder-protection'
// Hiding or blocking it hides the student's own folders too, so it gets a warning.
const SYSTEM_DRIVE = 'C'

// The policies in the grid: the ones the PCs apply, and file/folder protection, shown but not built.
type GridPolicyId = UserPolicyId | typeof NOT_BUILT_POLICY_ID

function isGridPolicyId(id: RestrictionPolicyId): id is GridPolicyId {
  return !OWN_SECTION_POLICY_IDS.includes(id)
}

type ApplyRestriction = (
  pcIds: number[],
  disabled: boolean,
) => Promise<ApiResult<BulkCommandResult> | null>

interface RestrictionsDialogProps {
  targetPcs: RegisteredPc[]
  // Null means the same bulk command is still running.
  onApplyInternet: (
    pcIds: number[],
    blocked: boolean,
  ) => Promise<ApiResult<InternetResult[]> | null>
  onApplyFastUserSwitching: ApplyRestriction
  onApplyTaskManager: ApplyRestriction
  onApplyRestrictions: (
    pcIds: number[],
    change: PcRestrictionsChange,
  ) => Promise<ApiResult<BulkCommandResult> | null>
  onClose: () => void
}

const policyOptions: CheckboxGroupOption<GridPolicyId>[] = restrictionPolicies.flatMap((policy) =>
  isGridPolicyId(policy.id)
    ? [
        {
          value: policy.id,
          label: policy.appliesWhenExplorerStarts ? `${policy.label} (*)` : policy.label,
          disabledNote: policy.id === NOT_BUILT_POLICY_ID ? 'Not available yet' : undefined,
        },
      ]
    : [],
)

const driveOptions = driveLetters.map((letter) => ({ value: letter, label: letter }))

// The grid's states without file/folder protection, which is never sent.
function toUserPolicyStates(states: CheckStates<GridPolicyId>): CheckStates<UserPolicyId> {
  const { [NOT_BUILT_POLICY_ID]: _notBuilt, ...userPolicyStates } = states
  return userPolicyStates
}

// A failed or still-running command stops the rest, so the dialog stays open with what went wrong.
function getFailure(result: ApiResult<unknown> | null): string | null | undefined {
  if (!result) return undefined
  return result.success ? null : result.error
}

interface RestrictionCheckboxProps {
  label: string
  help: ReactNode
  choice: RestrictionChoice
  disabled: boolean
  onChange: (choice: RestrictionChoice) => void
}

// A tri-state checkbox: indeterminate while the PCs differ, until the administrator picks one.
function RestrictionCheckbox({ label, help, choice, disabled, onChange }: RestrictionCheckboxProps) {
  const helpId = useId()
  return (
    <>
      <label className="flex items-center gap-2 text-ink">
        <Checkbox
          ref={(checkbox) => {
            if (checkbox) checkbox.indeterminate = choice === 'mixed'
          }}
          checked={choice === 'disabled'}
          disabled={disabled}
          aria-describedby={helpId}
          onChange={(event) => onChange(event.target.checked ? 'disabled' : 'allowed')}
        />
        {label}
      </label>
      <p id={helpId} className="m-0 text-sm text-ink-muted">
        {help}
      </p>
    </>
  )
}

// The administrator's choice for one restriction flag, and whether it differs from what the PCs have now.
function useRestrictionChoice(pcs: RegisteredPc[], flag: RestrictionFlag) {
  const initialChoice = getRestrictionChoice(pcs, flag)
  const [choice, setChoice] = useState<RestrictionChoice>(initialChoice)
  const hasChange = choice !== 'mixed' && choice !== initialChoice
  return { choice, setChoice, hasChange }
}

// The administrator's choice for each item of one restriction list, and only the items changed from what the PCs have.
function useCheckChoices<T extends string>(
  pcs: RegisteredPc[],
  items: readonly T[],
  readList: (restrictions: PcRestrictions) => readonly string[],
) {
  const initialStates = getCheckStates(
    items,
    pcs.map((pc) => readList(pc.restrictions ?? emptyRestrictions()) as readonly T[]),
  )
  const [states, setStates] = useState<CheckStates<T>>(initialStates)
  const changes = getCheckChanges(initialStates, states)
  return { states, setStates, changes, hasChange: Object.keys(changes).length > 0 }
}

export function RestrictionsDialog({
  targetPcs,
  onApplyInternet,
  onApplyFastUserSwitching,
  onApplyTaskManager,
  onApplyRestrictions,
  onClose,
}: RestrictionsDialogProps) {
  const titleId = useId()
  const internetHelpId = useId()
  const listedPcs = targetPcs.filter((pc) => !pc.isServerPc)
  const hasServerPc = targetPcs.some((pc) => pc.isServerPc)
  const initialInternetChoice = getInternetChoice(listedPcs)
  const [internetChoice, setInternetChoice] = useState<InternetChoice>(initialInternetChoice)
  const switching = useRestrictionChoice(listedPcs, 'fastUserSwitchingDisabled')
  const taskManager = useRestrictionChoice(listedPcs, 'taskManagerDisabled')
  const policies = useCheckChoices(listedPcs, USER_POLICY_IDS, (restrictions) => restrictions.policies)
  const hiddenDrives = useCheckChoices(listedPcs, DRIVE_LETTERS, (restrictions) => restrictions.hiddenDrives)
  const disabledDrives = useCheckChoices(listedPcs, DRIVE_LETTERS, (restrictions) => restrictions.disabledDrives)
  const [applyNow, setApplyNow] = useState(false)
  const applyNowHelpId = useId()
  const hasListChange = policies.hasChange || hiddenDrives.hasChange || disabledDrives.hasChange
  const isSystemDriveChosen =
    hiddenDrives.states[SYSTEM_DRIVE] === 'on' || disabledDrives.states[SYSTEM_DRIVE] === 'on'
  const [isApplying, setIsApplying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasInternetChange =
    internetChoice !== 'mixed' && internetChoice !== initialInternetChoice

  async function applyInternet(): Promise<string | null | undefined> {
    if (!hasInternetChange) return null
    const blocked = internetChoice === 'blocked'
    return getFailure(await onApplyInternet(getPcIdsToSetInternet(listedPcs, blocked), blocked))
  }

  async function applyRestriction(
    flag: RestrictionFlag,
    { choice, hasChange }: { choice: RestrictionChoice; hasChange: boolean },
    onApply: ApplyRestriction,
  ): Promise<string | null | undefined> {
    if (!hasChange) return null
    const disabled = choice === 'disabled'
    return getFailure(await onApply(getPcIdsToSetRestriction(listedPcs, flag, disabled), disabled))
  }

  // Sent only when a policy or drive changed. Every listed PC gets the same change, and keeps its other choices.
  async function applyRestrictionLists(): Promise<string | null | undefined> {
    if (!hasListChange) return null
    const change: PcRestrictionsChange = {
      policies: policies.changes,
      hiddenDrives: hiddenDrives.changes,
      disabledDrives: disabledDrives.changes,
      applyNow,
    }
    return getFailure(await onApplyRestrictions(listedPcs.map((pc) => pc.id), change))
  }

  async function applyChanges() {
    if (!hasInternetChange && !switching.hasChange && !taskManager.hasChange && !hasListChange) {
      onClose()
      return
    }
    setIsApplying(true)
    setErrorMessage(null)
    let failure = await applyInternet()
    if (failure === null) {
      failure = await applyRestriction('fastUserSwitchingDisabled', switching, onApplyFastUserSwitching)
    }
    if (failure === null) {
      failure = await applyRestriction('taskManagerDisabled', taskManager, onApplyTaskManager)
    }
    if (failure === null) failure = await applyRestrictionLists()
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
          <RestrictionCheckbox
            label="Disable Fast User Switch"
            help={
              <>
                Hides &quot;Switch user&quot;, so a student can&apos;t leave the Lykantra session for
                another account. Offline PCs apply it when they start. Needs client 0.29.0 or newer.
              </>
            }
            choice={switching.choice}
            disabled={isApplying}
            onChange={switching.setChoice}
          />
        </fieldset>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
            Policies
          </legend>
          <RestrictionCheckbox
            label="Disable Access to Task Manager"
            help={
              <>
                Students can&apos;t open Task Manager, including from Ctrl+Alt+Del. Offline PCs apply
                it when they start. Needs client 0.31.0 or newer.
              </>
            }
            choice={taskManager.choice}
            disabled={isApplying}
            onChange={taskManager.setChoice}
          />
        </fieldset>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CheckboxGroup
            legend="Other policies"
            options={policyOptions}
            states={{ ...policies.states, [NOT_BUILT_POLICY_ID]: 'off' }}
            disabled={isApplying}
            onChange={(states) => policies.setStates(toUserPolicyStates(states))}
          />
          <CheckboxGroup
            legend="Hide Drives (*)"
            options={driveOptions}
            states={hiddenDrives.states}
            className="grid grid-cols-2"
            disabled={isApplying}
            onChange={hiddenDrives.setStates}
          />
          <CheckboxGroup
            legend="Disable Drives (*)"
            options={driveOptions}
            states={disabledDrives.states}
            className="grid grid-cols-2"
            disabled={isApplying}
            onChange={disabledDrives.setStates}
          />
        </div>
        {isSystemDriveChosen && (
          <Banner variant="warning" icon="alert">
            Hiding or disabling C blocks Desktop, Documents and Downloads in File Explorer.
          </Banner>
        )}
        <label className="flex items-center gap-2 text-ink">
          <Checkbox
            checked={applyNow}
            disabled={isApplying}
            aria-describedby={applyNowHelpId}
            onChange={(event) => setApplyNow(event.target.checked)}
          />
          Apply without restarting computer
        </label>
        <div id={applyNowHelpId} className="flex flex-col gap-1 text-sm text-ink-muted">
          <p className="m-0">
            * File Explorer options. When &quot;Apply without restarting computer&quot; is ticked, File
            Explorer restarts on the PCs so they apply in a few seconds, and open File Explorer
            windows close. Otherwise they apply at the student&apos;s next sign-in. Registry Editor
            and Command Prompt apply right away either way.
          </p>
          <p className="m-0">Disabling a drive only blocks it in File Explorer, not in other programs.</p>
          <p className="m-0">
            OK applies every change to the PCs listed above. Offline PCs apply them when they start.
            Needs client 0.32.0 or newer.
          </p>
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
