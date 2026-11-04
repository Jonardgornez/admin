import type { DriveLetter, RestrictionPolicy } from '../types'

export const restrictionPolicies: RestrictionPolicy[] = [
  { id: 'task-manager', label: 'Disable Access to Task Manager', needsReboot: false },
  { id: 'registry-editor', label: 'Disable Access to Registry Editor', needsReboot: false },
  { id: 'command-prompt', label: 'Disable Command Prompt', needsReboot: false },
  { id: 'run-command', label: 'Disable Run Command', needsReboot: true },
  { id: 'control-panel', label: 'Disable Access to Control Panel', needsReboot: true },
  { id: 'add-printer', label: 'Disable Add Printer', needsReboot: true },
  { id: 'remove-printer', label: 'Disable Remove Printer', needsReboot: true },
  { id: 'windows-logout', label: 'Hide Windows Logout Button', needsReboot: true },
  { id: 'fast-user-switch', label: 'Disable Fast User Switch', needsReboot: false },
  { id: 'windows-shutdown', label: 'Hide Windows Shutdown Button', needsReboot: true },
  { id: 'file-folder-protection', label: 'Enable File/Folder Protection', needsReboot: false },
]

export const driveLetters: DriveLetter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
]
