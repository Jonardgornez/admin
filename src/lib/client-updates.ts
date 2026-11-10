import type { ClientUpdateState, ClientUpdateStatus, Pc } from '../types'
import { formatPcCount } from './pcs'

const BYTES_PER_MB = 1024 * 1024
const UNKNOWN_VERSION_LABEL = 'Version unknown'

export const INSTALL_NOW_WARNING_SECONDS = 60

export const CLIENT_UPDATE_HINT =
  'Upload any LykantraSetup.exe (it replaces the one stored here), then choose which PCs to update on the Dashboard. A PC installs it when nobody is using it, and only if it is newer than the version the PC already has.'
export const INSTALLER_FORMAT_NOTE = 'LykantraSetup.exe, up to 150 MB.'
export const REMOVE_RELEASE_BODY = "PCs that haven't installed it yet won't get it."

export function formatClientVersion(version: string | null | undefined): string {
  return version ? `v${version}` : UNKNOWN_VERSION_LABEL
}

export function formatInstallerSize(sizeBytes: number): string {
  return `${(sizeBytes / BYTES_PER_MB).toFixed(1)} MB`
}

const UPLOADED_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
}

export function formatReleaseUploaded(uploadedAtUtc: string): string {
  const uploaded = new Date(uploadedAtUtc).toLocaleString(undefined, UPLOADED_FORMAT_OPTIONS)
  return `Uploaded ${uploaded}`
}

const UPDATE_LABELS: Record<Exclude<ClientUpdateState, 'pending'>, (version: string) => string> = {
  downloading: (version) => `Downloading ${version}…`,
  installing: (version) => `Installing ${version}…`,
  failed: () => 'Update failed',
}

type ClientUpdatePc = Pick<Pc, 'name' | 'status'>

// A locked PC never installs, so it waits for unlock whatever the install-now choice is.
// Only a PC in use waits for someone to leave. Any other PC starts the update at its next idle check.
function getPendingUpdateLabel(clientUpdate: ClientUpdateStatus, pc: ClientUpdatePc): string {
  const prefix = `Update to ${clientUpdate.targetVersion}`
  if (pc.status === 'frozen') return `${prefix} — waits until ${pc.name} is unlocked`
  if (pc.status !== 'in-use') return `${prefix} starting soon`
  if (clientUpdate.installNow) {
    return `${prefix} — installing after a ${INSTALL_NOW_WARNING_SECONDS}-second warning`
  }
  return `${prefix} — waits until ${pc.name} is free`
}

export function getClientUpdateLabel(clientUpdate: ClientUpdateStatus, pc: ClientUpdatePc): string {
  if (clientUpdate.state === 'pending') return getPendingUpdateLabel(clientUpdate, pc)
  return UPDATE_LABELS[clientUpdate.state](clientUpdate.targetVersion)
}

export function describeClientUpdateResult(affected: number): string {
  return affected === 0
    ? 'No PCs needed this update.'
    : `Update queued for ${formatPcCount(affected)}.`
}

export function describeClientUpdateCancelResult(affected: number): string {
  return affected === 0
    ? 'No PCs had an update to cancel.'
    : `Cancelled the update for ${formatPcCount(affected)}.`
}
