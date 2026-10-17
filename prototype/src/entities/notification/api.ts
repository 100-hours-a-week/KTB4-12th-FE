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

export function getNotificationMessage(notification: Notification) {
  if (notification.type !== 'GIFT_COMPLETED_REWARD' || notification.message.includes('크레딧'))
    return notification.message;
  // shortcut: 기존 알림에는 rewardAmount가 없으므로 고정 보상액을 표시하고, API 메타데이터 추가 시 제거한다.
  return notification.message.replace(
    '선물 완료 보상이 지급되었습니다.',
    '선물 완료 보상 100,000 크레딧이 지급되었습니다.',
  );
}

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
    type: 'GIFT_COMPLETED_REWARD',
    title: '보상이 지급되었어요',
    message: '그린티 수분 크림 선물 완료 보상 100,000 크레딧이 지급되었습니다.',
    referenceType: 'GIFT',
    referenceId: 410,
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
