import { DRIVE_LETTERS, type DriveLetter, type RestrictionPolicy } from '../types'

export const restrictionPolicies: RestrictionPolicy[] = [
  { id: 'task-manager', label: 'Disable Access to Task Manager', appliesWhenExplorerStarts: false },
  { id: 'registry-editor', label: 'Disable Access to Registry Editor', appliesWhenExplorerStarts: false },
  { id: 'command-prompt', label: 'Disable Command Prompt', appliesWhenExplorerStarts: false },
  { id: 'run-command', label: 'Disable Run Command', appliesWhenExplorerStarts: true },
  { id: 'control-panel', label: 'Disable Access to Control Panel', appliesWhenExplorerStarts: true },
  { id: 'add-printer', label: 'Disable Add Printer', appliesWhenExplorerStarts: true },
  { id: 'remove-printer', label: 'Disable Remove Printer', appliesWhenExplorerStarts: true },
  { id: 'windows-logout', label: 'Hide Windows Logout Button', appliesWhenExplorerStarts: true },
  { id: 'fast-user-switch', label: 'Disable Fast User Switch', appliesWhenExplorerStarts: false },
  { id: 'windows-shutdown', label: 'Hide Windows Shutdown Button', appliesWhenExplorerStarts: true },
  { id: 'file-folder-protection', label: 'Enable File/Folder Protection', appliesWhenExplorerStarts: false },
]

export const driveLetters: DriveLetter[] = [...DRIVE_LETTERS]
