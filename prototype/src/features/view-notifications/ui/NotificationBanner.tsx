import { BellIcon, Cross2Icon } from '@radix-ui/react-icons';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { getNotificationMessage, type Notification } from '../../../entities/notification';

export function NotificationBanner({
  notification,
  busy,
  onSelect,
  onDismiss,
}: {
  notification: Notification | null;
  busy: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {notification ? (
        <motion.div
          key={notification.notificationId}
          className="notification-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: reducedMotion ? 0 : -110 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : -110, pointerEvents: 'none' }}
          transition={
            reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
          }
        >
          <button
            type="button"
            className="notification-banner-content"
            disabled={busy}
            onClick={onSelect}
          >
            <span className="notification-banner-icon">
              <BellIcon aria-hidden="true" />
            </span>
            <span>
              <span className="notification-banner-label">선잘알 · 새 알림</span>
              <strong>{notification.title}</strong>
              <span>{getNotificationMessage(notification)}</span>
            </span>
          </button>
          <button
            type="button"
            className="notification-banner-dismiss"
            aria-label="알림 배너 닫기"
            onClick={onDismiss}
          >
            <Cross2Icon />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
