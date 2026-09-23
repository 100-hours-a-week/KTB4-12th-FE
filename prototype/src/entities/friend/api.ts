import { apiGet, apiPost, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import { type Friend, mockFriends } from './model';

export async function fetchFriends(
  cursor: string | null,
  query: string,
): Promise<CursorPage<Friend>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? mockFriends.filter((friend) => friend.name.toLowerCase().includes(normalized))
      : mockFriends;
    return mockPage(filtered, cursor);
  }
  const path = query.trim() ? '/friends/search' : '/friends';
  const data = await apiGet<{ items: Friend[]; pagination: Pagination }>(path, {
    query: query.trim() || undefined,
    cursor: cursor ?? undefined,
  });
  return { items: data.items, pagination: data.pagination };
}

export async function addFriend(
  friendUserId: number,
): Promise<{ friendUserId: number; friendName: string }> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    const friend = mockFriends.find((item) => item.userId === friendUserId);
    return { friendUserId, friendName: friend?.name ?? '김민정' };
  }
  return apiPost('/friends', { friendUserId });
}
