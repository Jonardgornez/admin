import type { BulkLockKind, RegisteredPc } from '../types'

// The PC ids are fixed when the dialog opens, so the confirmed count matches what was shown.
export interface BulkLockAction {
  kind: BulkLockKind
  pcIds: number[]
}

// One PC is locked from its card or its details. Unlocking one PC does not open this dialog.
export interface SingleLockAction {
  kind: 'lock'
  pc: RegisteredPc
}

export type LockAction = BulkLockAction | SingleLockAction

export function getLockActionPcIds(action: LockAction): number[] {
  return 'pc' in action ? [action.pc.id] : action.pcIds
}
