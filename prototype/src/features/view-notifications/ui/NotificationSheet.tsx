import { useCallback, useState } from 'react';

import {
  fetchNotifications,
  markNotificationRead,
  type Notification,
} from '../../../entities/notification';
import { BottomSheet } from '../../../mobile';
import { getSessionVersion } from '../../../shared/api/session';
import { useCursorList } from '../../../shared/lib/useCursorList';
import { InfiniteCursor } from '../../../shared/ui';

export function NotificationSheet({
  open,
  onOpenChange,
  onSelect,
  onRead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (notification: Notification) => void;
  onRead: (unreadCount: number) => void;
}) {
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const loader = useCallback(
    (cursor: string | null) =>
      open
        ? fetchNotifications(cursor)
        : Promise.resolve({ items: [], pagination: { nextCursor: null, hasNext: false } }),
    [open],
  );
  const list = useCursorList(loader, open ? 'notifications-open' : 'notifications-closed');

  const select = async (notification: Notification) => {
    const version = getSessionVersion();
    setSelectionError(null);
    try {
      if (!notification.isRead) {
        const result = await markNotificationRead(notification.notificationId);
        if (version !== getSessionVersion()) return;
        onRead(result.unreadCount);
      }
      onOpenChange(false);
      onSelect(notification);
    } catch (reason) {
      if (version !== getSessionVersion()) return;
      setSelectionError(reason instanceof Error ? reason.message : '알림을 읽지 못했습니다.');
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="알림" snap={0.72}>
      <div className="notification-list">
        {list.items.map((notification) => (
          <button
            type="button"
            className={notification.isRead ? 'notification-card read' : 'notification-card'}
            key={notification.notificationId}
            onClick={() => void select(notification)}
          >
            <strong>{notification.title}</strong>
            <span>{notification.message}</span>
            <time dateTime={notification.notifiedAt}>
              {new Date(notification.notifiedAt).toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </button>
        ))}
      </div>
      <InfiniteCursor
        {...list}
        error={selectionError ?? list.error}
        itemCount={list.items.length}
        emptyLabel="새로운 알림이 없어요"
        onLoadMore={list.loadMore}
        onRetry={() => {
          setSelectionError(null);
          list.retry();
        }}
      />
    </BottomSheet>
  );
}
