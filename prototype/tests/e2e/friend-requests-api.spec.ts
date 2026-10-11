import { expect, test } from '@playwright/test';

test('친구 요청 목록은 items 응답과 방향별 커서를 사용하고 오류 후 재시도한다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'test-token');
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 1,
          name: '나',
          email: 'me@example.com',
          birth: '2000-01-01',
          isBirthdayPublic: false,
          giftSummary: { sentCount: 0, receivedCount: 0 },
        },
      },
    }),
  );
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: { data: { friends: [], pagination: { nextCursor: null, hasNext: false } } },
    }),
  );
  const cursors: (string | null)[] = [];
  let fail = true;
  await page.route('**/friend-requests/received*', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    cursors.push(cursor);
    if (fail) {
      fail = false;
      return route.fulfill({
        status: 500,
        json: {
          message: '친구 요청 목록 조회에 실패했습니다. 다시 시도해 주세요.',
          error: { code: 'INTERNAL_SERVER_ERROR' },
        },
      });
    }
    return route.fulfill({
      json: {
        data: {
          items: Array.from({ length: cursor ? 1 : 20 }, (_, index) => ({
            requestId: (cursor ? 100 : 0) + index,
            status: 'PENDING',
            requesterId: 2 + index,
            requesterName: cursor ? '마지막 요청자' : `요청자 ${index}`,
            receiverId: 1,
            receiverName: '나',
            createdAt: '2026-10-09T12:00:00',
          })),
          pagination: { nextCursor: cursor ? null : 'received-opaque', hasNext: !cursor },
        },
      },
    });
  });
  await page.route('**/friend-requests/sent*', (route) => {
    expect(new URL(route.request().url()).searchParams.has('cursor')).toBe(false);
    return route.fulfill({
      json: { data: { items: [], pagination: { nextCursor: null, hasNext: false } } },
    });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: '받은 요청' }).click();
  await expect(
    page.getByText('친구 요청 목록 조회에 실패했습니다. 다시 시도해 주세요.'),
  ).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('.friend-card')).toHaveCount(20);
  await page.getByTestId('mobile-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.getByText('마지막 요청자', { exact: true })).toBeVisible();
  expect(cursors).toEqual([null, null, 'received-opaque']);
  await page.getByRole('tab', { name: '보낸 요청' }).click();
  await expect(page.getByText('보낸 친구 요청이 없어요')).toBeVisible();
});

test('친구 요청 생성은 receiverId만 전송하고 충돌 메시지를 표시한다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'test-token');
  });
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: { data: { friends: [], pagination: { nextCursor: null, hasNext: false } } },
    }),
  );
  await page.route('**/users/search*', (route) =>
    route.fulfill({
      json: { data: { user: { userId: 27, name: '김민정', email: 'friend@example.com' } } },
    }),
  );
  let calls = 0;
  await page.route('**/friend-requests', (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ receiverId: 27 });
    calls++;
    if (calls === 1)
      return route.fulfill({
        status: 409,
        json: {
          message: '이미 친구 요청을 보냈습니다.',
          error: { code: 'FRIEND_ALREADY_REQUESTED' },
        },
      });
    return route.fulfill({
      status: 201,
      json: {
        data: {
          requestId: 7,
          status: 'PENDING',
          requesterId: 1,
          requesterName: '나',
          receiverId: 27,
          receiverName: '김민정',
          createdAt: '2026-10-09T12:00:00',
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await page.getByLabel('친구 이메일 검색').fill('friend@example.com');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('button', { name: '김민정 추가', exact: true }).click();
  await expect(page.locator('.app-toast')).toHaveText('이미 친구 요청을 보냈습니다.');
  await page.getByRole('button', { name: '김민정 추가', exact: true }).click();
  await expect(page.getByRole('button', { name: '김민정 요청 보냄', exact: true })).toBeDisabled();
  expect(calls).toBe(2);
});

for (const origin of ['sent', 'mypage'] as const) {
  test(`친구 요청 알림은 ${origin} 화면에서 받은 요청으로 이동한다`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'test-token');
    });
    await page.route('**/users/me', (route) =>
      route.fulfill({
        json: {
          data: {
            userId: 1,
            name: '나',
            email: 'me@example.com',
            birth: '2000-01-01',
            isBirthdayPublic: false,
            giftSummary: { sentCount: 0, receivedCount: 0 },
          },
        },
      }),
    );
    await page.route(/\/friends(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: { data: { friends: [], pagination: { nextCursor: null, hasNext: false } } },
      }),
    );
    await page.route('**/friend-requests/sent*', (route) =>
      route.fulfill({
        json: { data: { items: [], pagination: { nextCursor: null, hasNext: false } } },
      }),
    );
    await page.route('**/friend-requests/received*', (route) =>
      route.fulfill({
        json: {
          data: {
            items: [
              {
                requestId: 7,
                status: 'PENDING',
                requesterId: 27,
                requesterName: '김민정',
                receiverId: 1,
                receiverName: '나',
                createdAt: '2026-10-09T12:00:00',
              },
            ],
            pagination: { nextCursor: null, hasNext: false },
          },
        },
      }),
    );
    await page.route('**/notifications/unread-count', (route) =>
      route.fulfill({ json: { data: { unreadCount: 1 } } }),
    );
    await page.route(/\/notifications(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          data: {
            items: [
              {
                notificationId: 3,
                type: 'FRIEND_REQUEST_RECEIVED',
                title: '친구 요청이 도착했어요',
                message: '김민정님이 친구 요청을 보냈어요.',
                referenceType: 'FRIEND_REQUEST',
                referenceId: 7,
                notifiedAt: '2026-10-09T12:00:00',
                isRead: false,
              },
            ],
            pagination: { nextCursor: null, hasNext: false },
          },
        },
      }),
    );
    let read = false;
    await page.route('**/notifications/3/read', (route) => {
      expect(route.request().method()).toBe('PATCH');
      read = true;
      return route.fulfill({ json: { data: { notificationId: 3, isRead: true, unreadCount: 0 } } });
    });
    await page.goto('/');
    if (origin === 'sent') await page.getByRole('tab', { name: '보낸 요청' }).click();
    else
      await page
        .getByRole('navigation', { name: '하단 메뉴' })
        .getByRole('button', { name: '마이', exact: true })
        .click();
    await page.getByRole('button', { name: /알림 1개/ }).click();
    await page.getByRole('button', { name: /친구 요청이 도착했어요/ }).click();
    await expect(page.getByRole('dialog', { name: '알림', exact: true })).toBeHidden();
    await expect(page.getByRole('tab', { name: '받은 요청' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('.friend-card')).toContainText('김민정');
    expect(read).toBe(true);
  });
}
