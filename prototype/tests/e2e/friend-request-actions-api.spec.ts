import { expect, type Page, test } from '@playwright/test';

async function setup(page: Page, direction: 'received' | 'sent') {
  const state = { pending: true, accepted: false, listCalls: 0 };
  const friend = {
    friendId: 31,
    userId: 27,
    name: '김민정',
    email: 'friend@example.com',
    birth: null,
  };
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'test-token');
  });
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          friends: state.accepted ? [friend] : [],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
  await page.route(`**/friend-requests/${direction}*`, (route) => {
    state.listCalls++;
    return route.fulfill({
      json: {
        data: {
          items: state.pending
            ? [
                {
                  requestId: 7,
                  status: 'PENDING',
                  requesterId: direction === 'sent' ? 1 : 27,
                  requesterName: direction === 'sent' ? '나' : '김민정',
                  receiverId: direction === 'sent' ? 27 : 1,
                  receiverName: direction === 'sent' ? '김민정' : '나',
                  createdAt: '2026-10-09T12:00:00',
                },
              ]
            : [],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: direction === 'sent' ? '보낸 요청' : '받은 요청' }).click();
  await expect(page.locator('.friend-card')).toHaveCount(1);
  return state;
}

for (const action of ['accept', 'reject', 'cancel'] as const) {
  test(`친구 요청 ${action}: 확인 후 POST, 중복 클릭 방지, 목록 갱신`, async ({ page }) => {
    const direction = action === 'cancel' ? 'sent' : 'received';
    const label = { accept: '수락', reject: '거절', cancel: '요청 취소' }[action];
    const title = { accept: '친구 요청 수락', reject: '친구 요청 거절', cancel: '친구 요청 취소' }[
      action
    ];
    const state = await setup(page, direction);
    let calls = 0;
    let release: (() => void) | undefined;
    await page.route(`**/friend-requests/7/${action}`, async (route) => {
      calls++;
      expect(route.request().method()).toBe('POST');
      expect(route.request().postDataJSON()).toEqual({});
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      state.pending = false;
      state.accepted = action === 'accept';
      await route.fulfill({
        json: {
          data: {
            requestId: 7,
            status: { accept: 'ACCEPTED', reject: 'REJECTED', cancel: 'CANCELED' }[action],
          },
        },
      });
    });
    await page.getByRole('button', { name: label, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toContainText('김민정');
    await dialog.getByRole('button', { name: '돌아가기' }).click();
    expect(calls).toBe(0);
    await page.getByRole('button', { name: label, exact: true }).click();
    await dialog.getByRole('button', { name: label, exact: true }).click();
    await expect(dialog.getByRole('button', { name: '처리 중' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '돌아가기' })).toBeDisabled();
    await expect.poll(() => calls).toBe(1);
    release!();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.friend-card')).toHaveCount(0);
    await expect.poll(() => state.listCalls).toBe(2);
    if (action === 'accept') {
      await page.getByRole('tab', { name: '친구 목록', exact: true }).click();
      await expect(page.locator('.friend-card')).toContainText('김민정');
      await expect(page.getByRole('button', { name: '선물하기', exact: true })).toBeVisible();
    }
  });
}

for (const code of [
  'FRIEND_REQUEST_ALREADY_PROCESSED',
  'FRIEND_REQUEST_NOT_FOUND',
  'FRIEND_REQUEST_FORBIDDEN',
  'INTERNAL_SERVER_ERROR',
] as const) {
  test(`친구 요청 처리 실패 ${code}`, async ({ page }) => {
    const state = await setup(page, 'received');
    await page.route('**/friend-requests/7/accept', (route) => {
      if (code !== 'INTERNAL_SERVER_ERROR') state.pending = false;
      return route.fulfill({
        status: {
          FRIEND_REQUEST_ALREADY_PROCESSED: 409,
          FRIEND_REQUEST_NOT_FOUND: 404,
          FRIEND_REQUEST_FORBIDDEN: 403,
          INTERNAL_SERVER_ERROR: 500,
        }[code],
        json: { message: '요청을 처리하지 못했습니다.', error: { code } },
      });
    });
    await page.getByRole('button', { name: '수락', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '친구 요청 수락' });
    await dialog.getByRole('button', { name: '수락', exact: true }).click();
    await expect(page.locator('.app-toast')).toHaveText('요청을 처리하지 못했습니다.');
    if (code === 'INTERNAL_SERVER_ERROR') {
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: '수락', exact: true })).toBeEnabled();
      expect(state.pending).toBe(true);
    } else {
      await expect(dialog).toBeHidden();
      await expect(page.locator('.friend-card')).toHaveCount(0);
      await expect.poll(() => state.listCalls).toBe(2);
    }
  });
}
