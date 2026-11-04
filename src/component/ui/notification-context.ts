import { createContext, useContext } from 'react'
import type { IconName } from './icon'

export type Notify = (message: string, icon?: IconName) => void

export const NotificationContext = createContext<Notify | null>(null)

export function useNotify(): Notify {
  const notify = useContext(NotificationContext)
  if (!notify) {
    throw new Error('useNotify must be used within a NotificationProvider')
  }
  return notify
}
