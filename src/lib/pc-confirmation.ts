import type { Pc, PendingPcAction, PowerCommand } from '../types'

export interface PcConfirmation {
  title: string
  body: string
  confirmLabel: string
}

interface PowerWording {
  label: string
  // Present tense for "before it ..." and "before they ..." in the countdown sentence.
  outcome: string
  pluralOutcome: string
  singleLossNote: string
  severalLossNote: string
}

const COUNTDOWN = 'The client shows a 30-second countdown before it'

const POWER_WORDING: Record<PowerCommand, PowerWording> = {
  shutdown: {
    label: 'Shut down',
    outcome: 'shuts down',
    pluralOutcome: 'shut down',
    singleLossNote: 'Unsaved work on that PC may be lost.',
    severalLossNote: 'Unsaved work on those PCs may be lost.',
  },
  reboot: {
    label: 'Reboot',
    outcome: 'restarts',
    pluralOutcome: 'restart',
    singleLossNote: 'Unsaved work on that PC may be lost, and the student is logged out.',
    severalLossNote:
      'Unsaved work on those PCs may be lost, and signed-in students are logged out.',
  },
}

function findPc(pcs: Pc[], pcName: string): Pc | undefined {
  return pcs.find((pc) => pc.name === pcName)
}

function describeSinglePc(pc: Pc | undefined, pcName: string, wording: PowerWording): string {
  if (pc?.user) {
    return `${pcName} has a user signed in (${pc.user}). ${COUNTDOWN} ${wording.outcome}. ${wording.singleLossNote}`
  }
  return `No user is signed in on ${pcName}, so no work should be lost. ${COUNTDOWN} ${wording.outcome}.`
}

function describeSeveralPcs(pcs: Pc[], pcNames: string[], wording: PowerWording): string {
  const countdown = `The clients show a 30-second countdown before they ${wording.pluralOutcome}.`
  const signedIn = pcNames.filter((name) => findPc(pcs, name)?.user).length
  if (signedIn === 0) {
    return `No user is signed in on these PCs, so no work should be lost. ${countdown}`
  }
  const subject = signedIn === 1 ? '1 of them has a user' : `${signedIn} of them have a user`
  return `${subject} signed in. ${countdown} ${wording.severalLossNote}`
}

function getPowerCommand(action: PendingPcAction): PowerCommand {
  return action.kind === 'reboot' || action.kind === 'reboot-selected' ? 'reboot' : 'shutdown'
}

function getSinglePcConfirmation(pcName: string, pcs: Pc[], wording: PowerWording): PcConfirmation {
  return {
    title: `${wording.label} ${pcName}?`,
    body: describeSinglePc(findPc(pcs, pcName), pcName, wording),
    confirmLabel: wording.label,
  }
}

export function getPcConfirmation(action: PendingPcAction, pcs: Pc[]): PcConfirmation {
  const wording = POWER_WORDING[getPowerCommand(action)]
  if ('pcName' in action) {
    return getSinglePcConfirmation(action.pcName, pcs, wording)
  }
  if (action.pcNames.length === 1) {
    return getSinglePcConfirmation(action.pcNames[0], pcs, wording)
  }
  return {
    title: `${wording.label} ${action.pcNames.length} PCs?`,
    body: describeSeveralPcs(pcs, action.pcNames, wording),
    confirmLabel: wording.label,
  }
}
