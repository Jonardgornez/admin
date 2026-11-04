import type { IconName } from '../component/ui/icon'

export type AppNotification = {
  id: number
  message: string
  icon: IconName
}

export const MAX_VISIBLE_NOTIFICATIONS = 3
export const NOTIFICATION_DURATION_MS = 4000

export function addNotification(
  list: AppNotification[],
  notification: AppNotification,
): AppNotification[] {
  return [...list, notification].slice(-MAX_VISIBLE_NOTIFICATIONS)
}

export function removeNotification(list: AppNotification[], id: number): AppNotification[] {
  return list.filter((notification) => notification.id !== id)
}
