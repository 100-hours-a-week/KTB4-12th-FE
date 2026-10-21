import { expect, test } from '@playwright/test';

test('선물 취소 확인 시 결제 취소 API를 호출한다', async ({ page }) => {
  const orderId = '00000000-0000-4000-8000-000000000501';
  let canceled = false;

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
    window.localStorage.setItem('gift-prototype-main-tab', 'mypage');
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        message: '내 정보를 조회했습니다.',
        data: {
          userId: 13,
          name: '네오',
          email: 'neo@test.com',
          birth: '2000-01-01',
          isBirthdayPublic: true,
          creditBalance: 500000,
          giftSummary: {
            sentCount: 1,
            receivedCount: 0,
            period: { from: '2026-01-01T00:00:00+09:00', to: '2026-10-17T23:59:59+09:00' },
          },
        },
      },
    }),
  );
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({
      json: { message: '미확인 알림 수를 조회했습니다.', data: { unreadCount: 0 } },
    }),
  );
  await page.route(/\/gifts\/sent(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        message: '보낸 선물을 조회했습니다.',
        data: {
          items: [
            {
              giftId: 501,
              orderId,
              giftStatus: canceled ? 'CANCELED' : 'WAITING_FOR_ACCEPTANCE',
              expiresAt: '2026-10-24T23:59:59+09:00',
              sentAt: '2026-10-17T12:00:00',
              recipient: { userId: 27, name: '김민지' },
              product: { productId: 101, name: '선물 상품', brand: '선잘알', thumbnailUrl: '' },
              quantity: 1,
              unitPrice: 32000,
              totalPrice: 32000,
            },
          ],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
  await page.route(`**/payments/${orderId}/cancellations`, (route) => {
    canceled = true;
    return route.fulfill({
      status: 201,
      json: {
        message: '결제와 선물을 취소했습니다.',
        data: {
          orderId,
          paymentStatus: 'CANCELED',
          giftId: 501,
          giftStatus: 'CANCELED',
          canceledAt: '2026-10-17T13:00:00+09:00',
        },
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /보낸 선물/ }).click();
  await page.getByRole('button', { name: '선물 취소' }).click();

  const requestPromise = page.waitForRequest((request) =>
    request.url().endsWith(`/payments/${orderId}/cancellations`),
  );
  await page
    .getByRole('dialog', { name: '선물을 취소할까요?' })
    .getByRole('button', { name: '취소하기' })
    .click();

  const request = await requestPromise;
  expect(request.method()).toBe('POST');
  expect(request.postData()).toBeNull();
  expect(request.headers()['idempotency-key']).toBeTruthy();
  await expect(page.getByRole('status')).toHaveText('선물 결제를 취소했습니다.');
});
