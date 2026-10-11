import { apiDelete, ApiError, apiGet, apiPost, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import { loadSession } from '../../shared/api/session';
import { isQaScenario, shouldFailUntilRecovery } from '../../shared/config/qaScenario';
import {
  type Friend,
  type FriendRequest,
  type FriendRequestAction,
  type FriendRequestDirection,
  mockFriends,
} from './model';

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
    const removedIds = readMockRemovedFriends();
    const friends = [...readMockAcceptedFriends(), ...mockFriends].filter(
      (friend) => !removedIds.includes(friend.friendId),
    );
    const filtered = normalized
      ? friends.filter((friend) => friend.name.toLowerCase().includes(normalized))
      : friends;
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
  receiverName: string,
): Promise<FriendRequest> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    if (isQaScenario('friend-add-error')) {
      throw new ApiError('친구 추가에 실패했습니다.', 500, { code: 'INTERNAL_SERVER_ERROR' });
    }
    const user = loadSession()?.user;
    const request: FriendRequest = {
      requestId: Date.now(),
      status: 'PENDING',
      requesterId: user?.userId ?? 1,
      requesterName: user?.name ?? '홍길동',
      receiverId: friendUserId,
      receiverName,
      createdAt: new Date().toISOString(),
    };
    const requests = readMockRequests();
    if (requests.some((item) => item.receiverId === friendUserId && item.status === 'PENDING')) {
      throw new ApiError('이미 친구 요청을 보냈습니다.', 409, { code: 'FRIEND_ALREADY_REQUESTED' });
    }
    window.sessionStorage.setItem(mockRequestsKey(), JSON.stringify([request, ...requests]));
    return request;
  }
  return apiPost('/friend-requests', { receiverId: friendUserId });
}

function mockRequestsKey() {
  return `mock-friend-requests:${loadSession()?.user?.userId ?? 1}`;
}

function readMockRequests(): FriendRequest[] {
  const stored = window.sessionStorage.getItem(mockRequestsKey());
  if (stored) return JSON.parse(stored) as FriendRequest[];
  return isQaScenario('friend-requests')
    ? [
        {
          requestId: 9001,
          status: 'PENDING',
          requesterId: 999,
          requesterName: '이서진',
          receiverId: loadSession()?.user?.userId ?? 1,
          receiverName: '홍길동',
          createdAt: new Date().toISOString(),
        },
      ]
    : [];
}

function readMockAcceptedFriends(): Friend[] {
  return JSON.parse(
    window.sessionStorage.getItem(`${mockRequestsKey()}:friends`) ?? '[]',
  ) as Friend[];
}

function readMockRemovedFriends(): number[] {
  return JSON.parse(
    window.sessionStorage.getItem(`${mockRequestsKey()}:removed`) ?? '[]',
  ) as number[];
}

export async function removeFriend(friendId: number): Promise<void> {
  if (!USE_MOCK_API) return apiDelete<void>(`/friends/${friendId}`);
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  window.sessionStorage.setItem(
    `${mockRequestsKey()}:removed`,
    JSON.stringify([...readMockRemovedFriends(), friendId]),
  );
}

export async function fetchFriendRequests(
  direction: FriendRequestDirection,
  cursor: string | null,
): Promise<CursorPage<FriendRequest>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    const userId = loadSession()?.user?.userId ?? 1;
    return mockPage(
      readMockRequests().filter(
        (request) =>
          request.status === 'PENDING' &&
          (direction === 'sent' ? request.requesterId : request.receiverId) === userId,
      ),
      cursor,
    );
  }
  return apiGet<CursorPage<FriendRequest>>(`/friend-requests/${direction}`, {
    cursor: cursor ?? undefined,
  });
}

export async function processFriendRequest(
  requestId: number,
  action: FriendRequestAction,
): Promise<FriendRequest> {
  if (!USE_MOCK_API) return apiPost(`/friend-requests/${requestId}/${action}`);
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  const requests = readMockRequests();
  const request = requests.find((item) => item.requestId === requestId);
  if (!request)
    throw new ApiError('친구 요청을 찾을 수 없습니다.', 404, { code: 'FRIEND_REQUEST_NOT_FOUND' });
  const userId = loadSession()?.user?.userId ?? 1;
  if ((action === 'cancel' ? request.requesterId : request.receiverId) !== userId)
    throw new ApiError('친구 요청을 처리할 권한이 없습니다.', 403, {
      code: 'FRIEND_REQUEST_FORBIDDEN',
    });
  const status = ({ accept: 'ACCEPTED', reject: 'REJECTED', cancel: 'CANCELED' } as const)[action];
  if (request.status === status) return request;
  if (request.status !== 'PENDING')
    throw new ApiError('이미 다른 작업으로 처리된 친구 요청입니다.', 409, {
      code: 'FRIEND_REQUEST_ALREADY_PROCESSED',
    });
  const updated = { ...request, status };
  window.sessionStorage.setItem(
    mockRequestsKey(),
    JSON.stringify(requests.map((item) => (item.requestId === requestId ? updated : item))),
  );
  if (action === 'accept')
    window.sessionStorage.setItem(
      `${mockRequestsKey()}:friends`,
      JSON.stringify([
        {
          friendId: requestId,
          userId: request.requesterId,
          name: request.requesterName,
          email: 'friend@example.com',
          birth: null,
        },
        ...readMockAcceptedFriends(),
      ]),
    );
  return updated;
}
