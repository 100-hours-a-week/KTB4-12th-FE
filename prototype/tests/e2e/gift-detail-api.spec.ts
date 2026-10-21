import { expect, type Page, test } from '@playwright/test';

const emptyReview = {
  status: 404,
  json: { message: '작성된 리뷰가 없습니다.', error: { code: 'REVIEW_NOT_FOUND' } },
};
const gift = (giftId: number) => ({
  giftId,
  receivedAt: '2026-10-01T12:00:00',
  sender: { userId: 2, name: `보낸 사람 ${giftId}` },
  product: { productId: giftId, name: `선물 ${giftId}`, brand: '테스트 브랜드' },
  quantity: 1,
  unitPrice: 1000,
  totalPrice: 1000,
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('accessToken', 'gift-detail-test-token');
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem(
      'gift-prototype-detail-route',
      JSON.stringify({ route: 'received-detail', returnRoute: 'mypage', giftId: 410 }),
    );
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 1,
          name: '테스트',
          email: 'me@example.com',
          birth: '2000-01-01',
          isBirthdayPublic: false,
          giftSummary: { sentCount: 0, receivedCount: 0 },
        },
      },
    }),
  );
  await page.route('**/notifications/events', (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: ':keepalive\n\n' }),
  );
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ json: { data: { unreadCount: 0 } } }),
  );
  await page.route(/\/notifications(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              notificationId: 50,
              type: 'GIFT_RECEIVED',
              title: '새 선물 알림',
              message: '선물 411이 도착했어요.',
              referenceType: 'GIFT',
              referenceId: 411,
              notifiedAt: '2026-10-01T12:00:00',
              isRead: true,
            },
          ],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
  await page.route('**/gifts/received/410', (route) =>
    route.fulfill({ json: { data: gift(410) } }),
  );
  await page.route('**/gifts/received/411', (route) =>
    route.fulfill({ json: { data: gift(411) } }),
  );
  await page.route(/\/gifts\/\d+\/review$/, (route) => route.fulfill(emptyReview));
});

async function openNextGift(page: Page) {
  await page.getByRole('button', { name: /알림 목록 열기/ }).click();
  await page
    .getByRole('dialog', { name: '알림', exact: true })
    .locator('.notification-card')
    .click();
}

test('다른 선물 조회 중·실패 시 이전 정보와 리뷰를 숨기고 성공 후에만 새 리뷰를 작성한다', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route('**/gifts/received/411', async (route) => {
    if (fail) {
      await gate;
      return route.fulfill({
        status: 500,
        json: { message: '새 선물 조회 실패', error: { code: 'INTERNAL_SERVER_ERROR' } },
      });
    }
    return route.fulfill({ json: { data: gift(411) } });
  });
  const reviewRequests: string[] = [];
  await page.route('**/gifts/411/review', (route) => {
    reviewRequests.push(route.request().method());
    if (route.request().method() === 'GET') return route.fulfill(emptyReview);
    expect(route.request().postDataJSON()).toEqual({ rating: 5, content: '새 선물의 후기' });
    return route.fulfill({
      status: 201,
      json: {
        data: {
          review: {
            reviewId: 1,
            giftId: 411,
            rating: 5,
            content: '새 선물의 후기',
            createdAt: '2026-10-01T12:00:00',
            updatedAt: '2026-10-01T12:00:00',
          },
        },
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.gift-detail-content')).toContainText('선물 410');
  await expect(page.getByRole('button', { name: '리뷰 작성' })).toBeVisible();
  const nextRequest = page.waitForRequest('**/gifts/received/411');
  await openNextGift(page);
  await nextRequest;
  await expect(page.locator('.gift-detail-surface')).toHaveCount(0);
  expect(reviewRequests).toEqual([]);
  release();
  await expect(page.getByRole('alert')).toContainText('새 선물 조회 실패');
  await expect(page.locator('.gift-detail-surface')).toHaveCount(0);
  expect(reviewRequests).toEqual([]);
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('.gift-detail-content')).toContainText('선물 411');
  await page.getByRole('button', { name: '5점', exact: true }).click();
  await page.getByLabel('후기').fill('새 선물의 후기');
  await page.getByRole('button', { name: '리뷰 작성' }).click();
  await expect(page.locator('.gift-review-readonly')).toContainText('새 선물의 후기');
  expect(reviewRequests.filter((method) => method !== 'GET')).toEqual(['POST']);
});

for (const oldStatus of [200, 500]) {
  test(`이전 선물의 늦은 ${oldStatus} 응답은 새 선물과 리뷰 상태를 바꾸지 않는다`, async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/gifts/received/410', async (route) => {
      await gate;
      await route.fulfill({
        status: oldStatus,
        json:
          oldStatus === 200
            ? { data: gift(410) }
            : { message: '이전 선물 조회 실패', error: { code: 'INTERNAL_SERVER_ERROR' } },
      });
    });
    const oldRequest = page.waitForRequest('**/gifts/received/410');
    await page.goto('/');
    await oldRequest;
    await openNextGift(page);
    await expect(page.locator('.gift-detail-content')).toContainText('선물 411');
    await page.getByRole('button', { name: '5점', exact: true }).click();
    await page.getByLabel('후기').fill('작성 중인 새 선물 후기');
    const oldResponse = page.waitForResponse('**/gifts/received/410');
    release();
    await (await oldResponse).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.locator('.gift-detail-content')).toContainText('선물 411');
    await expect(page.locator('.gift-detail-content')).not.toContainText('선물 410');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel('후기')).toHaveValue('작성 중인 새 선물 후기');
    await expect(page.getByRole('button', { name: '5점', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}
