import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  NOTIFICATION_DURATION_MS,
  addNotification,
  removeNotification,
  type AppNotification,
} from '../../lib/notifications'
import { Banner } from './banner'
import { NotificationContext, type Notify } from './notification-context'

interface NotificationItemProps {
  notification: AppNotification
  onRemove: (id: number) => void
}

function NotificationItem({ notification, onRemove }: NotificationItemProps) {
  const { id, message, icon } = notification

  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), NOTIFICATION_DURATION_MS)
    return () => clearTimeout(timer)
  }, [id, onRemove])

  return (
    <Banner
      variant="info"
      icon={icon}
      onDismiss={() => onRemove(id)}
      className="animate-notification bg-surface-200 shadow-pop motion-reduce:animate-none"
      style={{ animationDuration: `${NOTIFICATION_DURATION_MS}ms` }}
    >
      {message}
    </Banner>
  )
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const nextId = useRef(0)
  const popoverRef = useRef<HTMLDivElement>(null)

  const notify = useCallback<Notify>((message, icon = 'check') => {
    nextId.current += 1
    const notification: AppNotification = { id: nextId.current, message, icon }
    setNotifications((current) => addNotification(current, notification))
  }, [])

  const remove = useCallback((id: number) => {
    setNotifications((current) => removeNotification(current, id))
  }, [])

  const newestId = notifications.at(-1)?.id

  // Hiding a popover restarts its fade, so only re-raise it when a modal could be covering it.
  useLayoutEffect(() => {
    const popover = popoverRef.current
    if (!popover) return
    const isOpen = popover.matches(':popover-open')
    if (newestId === undefined) {
      if (isOpen) popover.hidePopover()
      return
    }
    if (isOpen && !document.querySelector('dialog:modal')) return
    if (isOpen) popover.hidePopover()
    popover.showPopover()
  }, [newestId])

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {notifications.map((notification) => (
          <p key={notification.id}>{notification.message}</p>
        ))}
      </div>
      <div
        ref={popoverRef}
        popover="manual"
        className="fixed inset-auto right-4 bottom-4 left-4 m-0 h-fit overflow-visible border-0 bg-transparent p-0 md:left-auto md:w-full md:max-w-detail"
      >
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onRemove={remove} />
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  )
}
