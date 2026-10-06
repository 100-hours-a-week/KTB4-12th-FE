import { ApiError, apiGet, apiPost, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import { isQaScenario, shouldFailUntilRecovery } from '../../shared/config/qaScenario';
import { type Friend, mockFriends } from './model';

export async function fetchFriends(
  cursor: string | null,
  query: string,
): Promise<CursorPage<Friend>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    if (!query.trim() && shouldFailUntilRecovery('friend-list-error')) {
      throw new ApiError('친구 목록 조회에 실패했습니다. 다시 시도해 주세요.', 500, {
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? mockFriends.filter((friend) => friend.name.toLowerCase().includes(normalized))
      : mockFriends;
    return mockPage(filtered, cursor);
  }
  const path = query.trim() ? '/friends/search' : '/friends';
  const data = await apiGet<{ friends: Friend[]; pagination: Pagination }>(path, {
    query: query.trim() || undefined,
    cursor: cursor ?? undefined,
  });
  return {
    items: Array.isArray(data?.friends) ? data.friends : [],
    pagination: data?.pagination ?? { nextCursor: null, hasNext: false },
  };
}

export async function addFriend(
  friendUserId: number,
): Promise<{ requestId: number; receiverId: number }> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    if (isQaScenario('friend-add-error')) {
      throw new ApiError('친구 추가에 실패했습니다.', 500, { code: 'INTERNAL_SERVER_ERROR' });
    }
    return { requestId: Date.now(), receiverId: friendUserId };
  }
  return apiPost('/friend-requests', { receiverId: friendUserId });
}
