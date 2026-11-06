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

// Numbers that start with a vowel sound when spoken take "an": 8, 11, 18, 80-89, 800-899, 1800-1899.
function getArticle(seconds: number): 'a' | 'an' {
  const startsWithVowelSound =
    [8, 11, 18].includes(seconds) ||
    (seconds >= 80 && seconds < 90) ||
    (seconds >= 800 && seconds < 900) ||
    (seconds >= 1800 && seconds < 1900)
  return startsWithVowelSound ? 'an' : 'a'
}

// Without the saved setting, the wording says "a countdown" rather than guessing a number.
function describeCountdown(countdownSeconds: number | null): string {
  if (countdownSeconds === null) return 'a countdown'
  return `${getArticle(countdownSeconds)} ${countdownSeconds}-second countdown`
}

function findPc(pcs: Pc[], pcName: string): Pc | undefined {
  return pcs.find((pc) => pc.name === pcName)
}

function describeSinglePc(
  pc: Pc | undefined,
  pcName: string,
  wording: PowerWording,
  countdown: string,
): string {
  if (pc?.user) {
    return `${pcName} has a user signed in (${pc.user}). The client shows ${countdown} before it ${wording.outcome}. ${wording.singleLossNote}`
  }
  return `No user is signed in on ${pcName}, so no work should be lost. The client shows ${countdown} before it ${wording.outcome}.`
}

function describeSeveralPcs(
  pcs: Pc[],
  pcNames: string[],
  wording: PowerWording,
  countdown: string,
): string {
  const countdownSentence = `The clients show ${countdown} before they ${wording.pluralOutcome}.`
  const signedIn = pcNames.filter((name) => findPc(pcs, name)?.user).length
  if (signedIn === 0) {
    return `No user is signed in on these PCs, so no work should be lost. ${countdownSentence}`
  }
  const subject = signedIn === 1 ? '1 of them has a user' : `${signedIn} of them have a user`
  return `${subject} signed in. ${countdownSentence} ${wording.severalLossNote}`
}

function getPowerCommand(action: PendingPcAction): PowerCommand {
  return action.kind === 'reboot' || action.kind === 'reboot-selected' ? 'reboot' : 'shutdown'
}

function getSinglePcConfirmation(
  pcName: string,
  pcs: Pc[],
  wording: PowerWording,
  countdown: string,
): PcConfirmation {
  return {
    title: `${wording.label} ${pcName}?`,
    body: describeSinglePc(findPc(pcs, pcName), pcName, wording, countdown),
    confirmLabel: wording.label,
  }
}

// The countdown is the saved setting, or null while it is unknown.
export function getPcConfirmation(
  action: PendingPcAction,
  pcs: Pc[],
  countdownSeconds: number | null,
): PcConfirmation {
  const wording = POWER_WORDING[getPowerCommand(action)]
  const countdown = describeCountdown(countdownSeconds)
  if ('pcName' in action) {
    return getSinglePcConfirmation(action.pcName, pcs, wording, countdown)
  }
  if (action.pcNames.length === 1) {
    return getSinglePcConfirmation(action.pcNames[0], pcs, wording, countdown)
  }
  return {
    title: `${wording.label} ${action.pcNames.length} PCs?`,
    body: describeSeveralPcs(pcs, action.pcNames, wording, countdown),
    confirmLabel: wording.label,
  }
}
