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
  emptyRestrictions,
  getCheckChanges,
  getCheckStates,
  getPcIdsToSetRestriction,
  getRestrictionChoice,
  type CheckState,
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

// Internet, Fast User Switching and Task Manager sit in the Policies list but are applied by their own commands.
const INTERNET_ID = 'internet'
const FAST_USER_SWITCH_ID = 'fast-user-switch'
const TASK_MANAGER_ID = 'task-manager'
const NOT_BUILT_POLICY_ID = 'file-folder-protection'
// Hiding or blocking it hides the student's own folders too, so it gets a warning.
const SYSTEM_DRIVE = 'C'

type PolicyListId = RestrictionPolicyId | typeof INTERNET_ID

const internetToState: Record<InternetChoice, CheckState> = { blocked: 'on', open: 'off', mixed: 'mixed' }
const stateToInternet: Record<CheckState, InternetChoice> = { on: 'blocked', off: 'open', mixed: 'mixed' }
const choiceToState: Record<RestrictionChoice, CheckState> = { disabled: 'on', allowed: 'off', mixed: 'mixed' }
const stateToChoice: Record<CheckState, RestrictionChoice> = { on: 'disabled', off: 'allowed', mixed: 'mixed' }

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

const policyOptions: CheckboxGroupOption<PolicyListId>[] = [
  { value: INTERNET_ID, label: 'Block internet' },
  ...restrictionPolicies.map((policy) => ({
    value: policy.id,
    label: policy.appliesWhenExplorerStarts ? `${policy.label} (*)` : policy.label,
    disabledNote: policy.id === NOT_BUILT_POLICY_ID ? 'Not available yet' : undefined,
  })),
]

const driveOptions = driveLetters.map((letter) => ({ value: letter, label: letter }))

// The list's states without the items that have their own commands, or that are never sent.
function toUserPolicyStates(states: CheckStates<PolicyListId>): CheckStates<UserPolicyId> {
  const {
    [INTERNET_ID]: _internet,
    [FAST_USER_SWITCH_ID]: _switching,
    [TASK_MANAGER_ID]: _taskManager,
    [NOT_BUILT_POLICY_ID]: _notBuilt,
    ...userPolicyStates
  } = states
  return userPolicyStates
}

// A failed or still-running command stops the rest, so the dialog stays open with what went wrong.
function getFailure(result: ApiResult<unknown> | null): string | null | undefined {
  if (!result) return undefined
  return result.success ? null : result.error
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
  const policyListStates: CheckStates<PolicyListId> = {
    [INTERNET_ID]: internetToState[internetChoice],
    ...policies.states,
    [TASK_MANAGER_ID]: choiceToState[taskManager.choice],
    [FAST_USER_SWITCH_ID]: choiceToState[switching.choice],
    [NOT_BUILT_POLICY_ID]: 'off',
  }

  function changePolicyList(states: CheckStates<PolicyListId>) {
    setInternetChoice(stateToInternet[states[INTERNET_ID]])
    switching.setChoice(stateToChoice[states[FAST_USER_SWITCH_ID]])
    taskManager.setChoice(stateToChoice[states[TASK_MANAGER_ID]])
    policies.setStates(toUserPolicyStates(states))
  }

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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CheckboxGroup
            legend="Policies"
            options={policyOptions}
            states={policyListStates}
            disabled={isApplying}
            onChange={changePolicyList}
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
            Block internet: PCs can still reach the Lykantra server and the lab network.
          </p>
          {hasServerPc && <p className="m-0">{SERVER_PC_INTERNET_NOTE}</p>}
          <p className="m-0">
            Disable Fast User Switch hides &quot;Switch user&quot;. Disable Access to Task Manager also
            blocks it from Ctrl+Alt+Del.
          </p>
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
