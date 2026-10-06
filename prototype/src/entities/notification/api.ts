import { apiGet, apiPatch, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';

export type Notification = {
  notificationId: number;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: number | null;
  notifiedAt: string;
  isRead: boolean;
};

let mockNotifications: Notification[] = [
  {
    notificationId: 1,
    type: 'GIFT_RECEIVED',
    title: '선물이 도착했어요',
    message: '김민지님이 선물을 보냈어요.',
    referenceType: 'GIFT',
    referenceId: 410,
    notifiedAt: new Date(2026, 8, 30, 14, 20).toISOString(),
    isRead: false,
  },
  {
    notificationId: 2,
    type: 'POINT_GRANTED',
    title: '포인트가 지급되었어요',
    message: '이벤트 참여 보상으로 1,000P가 지급되었습니다.',
    referenceType: null,
    referenceId: null,
    notifiedAt: new Date(2026, 8, 28, 9, 10).toISOString(),
    isRead: true,
  },
];

export async function fetchUnreadNotificationCount(): Promise<number> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return mockNotifications.filter((item) => !item.isRead).length;
  }
  const data = await apiGet<{ unreadCount: number }>('/notifications/unread-count');
  return data.unreadCount;
}

export async function fetchNotifications(cursor: string | null): Promise<CursorPage<Notification>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return mockPage(mockNotifications, cursor);
  }
  const data = await apiGet<{ items: Notification[]; pagination: Pagination }>('/notifications', {
    cursor: cursor ?? undefined,
  });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination ?? { nextCursor: null, hasNext: false },
  };
}

export async function markNotificationRead(
  notificationId: number,
): Promise<{ notificationId: number; isRead: true; unreadCount: number }> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    mockNotifications = mockNotifications.map((item) =>
      item.notificationId === notificationId ? { ...item, isRead: true } : item,
    );
    return {
      notificationId,
      isRead: true,
      unreadCount: mockNotifications.filter((item) => !item.isRead).length,
    };
  }
  return apiPatch<{ notificationId: number; isRead: true; unreadCount: number }>(
    `/notifications/${notificationId}/read`,
  );
}
