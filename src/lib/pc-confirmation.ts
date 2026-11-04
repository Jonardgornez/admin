import type { Pc, PendingPcAction } from '../types'

export interface PcConfirmation {
  title: string
  body: string
  confirmLabel: string
}

const COUNTDOWN = 'The client shows a 30-second countdown before it'

function findPc(pcs: Pc[], pcName: string): Pc | undefined {
  return pcs.find((pc) => pc.name === pcName)
}

function describeSinglePc(pc: Pc | undefined, pcName: string, verb: string): string {
  if (pc?.user) {
    return `${pcName} has a user signed in (${pc.user}). ${COUNTDOWN} ${verb}. Unsaved work on that PC may be lost.`
  }
  return `No user is signed in on ${pcName}, so no work should be lost. ${COUNTDOWN} ${verb}.`
}

function describeSeveralPcs(pcs: Pc[], pcNames: string[]): string {
  const signedIn = pcNames.filter((name) => findPc(pcs, name)?.user).length
  if (signedIn === 0) {
    return 'No user is signed in on these PCs, so no work should be lost. The clients show a 30-second countdown before they shut down.'
  }
  const subject = signedIn === 1 ? '1 of them has a user' : `${signedIn} of them have a user`
  return `${subject} signed in. The clients show a 30-second countdown before they shut down. Unsaved work on those PCs may be lost.`
}

export function getPcConfirmation(action: PendingPcAction, pcs: Pc[]): PcConfirmation {
  if (action.kind === 'reboot') {
    return {
      title: `Reboot ${action.pcName}?`,
      body: describeSinglePc(findPc(pcs, action.pcName), action.pcName, 'restarts'),
      confirmLabel: 'Reboot',
    }
  }

  if (action.kind === 'shutdown') {
    return {
      title: `Shut down ${action.pcName}?`,
      body: describeSinglePc(findPc(pcs, action.pcName), action.pcName, 'shuts down'),
      confirmLabel: 'Shut down',
    }
  }

  if (action.pcNames.length === 1) {
    return getPcConfirmation({ kind: 'shutdown', pcName: action.pcNames[0] }, pcs)
  }

  return {
    title: `Shut down ${action.pcNames.length} PCs?`,
    body: describeSeveralPcs(pcs, action.pcNames),
    confirmLabel: 'Shut down',
  }
}
