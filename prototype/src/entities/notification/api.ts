import { apiGet, apiPatch, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';

export type GiftNotification = {
  notificationId: number;
  giftId: number;
  senderName: string;
  productName: string;
  quantity: number;
  notifiedAt: string;
  isRead: boolean;
};

export async function fetchUnreadNotificationCount(): Promise<number> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return 0;
  }
  const data = await apiGet<{ unreadCount: number }>('/notifications/unread-count');
  return data.unreadCount;
}

export async function fetchNotifications(
  cursor: string | null,
): Promise<CursorPage<GiftNotification>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return mockPage<GiftNotification>([], cursor);
  }
  const data = await apiGet<{ notifications: GiftNotification[]; pagination: Pagination }>(
    '/notifications',
    { cursor: cursor ?? undefined },
  );
  return { items: data.notifications, pagination: data.pagination };
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return;
  }
  await apiPatch(`/notifications/${notificationId}/read`);
}
