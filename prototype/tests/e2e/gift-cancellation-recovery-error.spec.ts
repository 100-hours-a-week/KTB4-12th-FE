import { expect, type Page, test } from '@playwright/test';

const orderId = '00000000-0000-4000-8000-000000000501';

type CancellationState = {
  status: 'PENDING' | 'COMPLETED' | 'DECLINED' | 'FAILED' | null;
  failureCode: string | null;
  responseMode: '202' | '409' | '201';
  postCalls: number;
  idempotencyKeys: string[];
  statusCalls: number;
  acceptCalls: number;
};

async function setup(page: Page, initialStatus: CancellationState['status'] = null) {
  const state: CancellationState = {
    status: initialStatus,
    failureCode: initialStatus === 'PENDING' ? 'CANCELLATION_RESULT_UNCONFIRMED' : null,
    responseMode: '202',
    postCalls: 0,
    idempotencyKeys: [],
    statusCalls: 0,
    acceptCalls: 0,
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'cancellation-test-token');
    localStorage.setItem('gift-prototype-main-tab', 'mypage');
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 13,
          name: '네오',
          email: 'neo@test.com',
          birth: '2000-01-01',
          isBirthdayPublic: true,
          creditBalance: 500000,
          giftSummary: {
            sentCount: 1,
            receivedCount: 1,
            period: { from: '2026-01-01T00:00:00+09:00', to: '2026-10-17T23:59:59+09:00' },
          },
        },
      },
    }),
  );
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ json: { data: { unreadCount: 0 } } }),
  );
  await page.route('**/notifications/events', (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: ':keepalive\n\n' }),
  );
  await page.route('**/payments/pending', (route) => route.fulfill({ json: { data: [] } }));
  await page.route(/\/gifts\/sent(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              giftId: 501,
              orderId,
              giftStatus: state.status === 'COMPLETED' ? 'CANCELED' : 'WAITING_FOR_ACCEPTANCE',
              paymentStatus: state.status === 'COMPLETED' ? 'CANCELED' : 'COMPLETED',
              expiresAt: '2026-10-24T23:59:59+09:00',
              sentAt: '2026-10-17T12:00:00+09:00',
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
  await page.route(/\/gifts\/received(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              giftId: 401,
              orderId,
              giftStatus: state.status === 'COMPLETED' ? 'CANCELED' : 'WAITING_FOR_ACCEPTANCE',
              expiresAt: '2026-10-24T23:59:59+09:00',
              receivedAt: '2026-10-17T12:00:00+09:00',
              sender: { userId: 27, name: '김민지' },
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
  await page.route(`**/gifts/sent/501`, (route) =>
    route.fulfill({
      json: {
        data: {
          giftId: 501,
          orderId,
          giftStatus: state.status === 'COMPLETED' ? 'CANCELED' : 'WAITING_FOR_ACCEPTANCE',
          paymentStatus: state.status === 'COMPLETED' ? 'CANCELED' : 'COMPLETED',
          expiresAt: '2026-10-24T23:59:59+09:00',
          sentAt: '2026-10-17T12:00:00+09:00',
          recipient: { userId: 27, name: '김민지' },
          product: { productId: 101, name: '선물 상품', brand: '선잘알', thumbnailUrl: '' },
          quantity: 1,
          unitPrice: 32000,
          totalPrice: 32000,
        },
      },
    }),
  );
  await page.route(`**/gifts/received/401`, (route) =>
    route.fulfill({
      json: {
        data: {
          giftId: 401,
          orderId,
          giftStatus: state.status === 'COMPLETED' ? 'CANCELED' : 'WAITING_FOR_ACCEPTANCE',
          expiresAt: '2026-10-24T23:59:59+09:00',
          receivedAt: '2026-10-17T12:00:00+09:00',
          sender: { userId: 27, name: '김민지' },
          product: { productId: 101, name: '선물 상품', brand: '선잘알', thumbnailUrl: '' },
          quantity: 1,
          unitPrice: 32000,
          totalPrice: 32000,
        },
      },
    }),
  );
  await page.route(`**/payments/${orderId}`, (route) => {
    state.statusCalls++;
    return route.fulfill({
      json: {
        data: {
          orderId,
          paymentStatus: state.status === 'COMPLETED' ? 'CANCELED' : 'COMPLETED',
          approvalResult: 'APPROVED',
          failureCode: null,
          cancellationId: state.status ? 901 : null,
          cancellationStatus: state.status,
          cancellationFailureCode: state.failureCode,
          giftId: 501,
          giftStatus: state.status === 'COMPLETED' ? 'CANCELED' : 'WAITING_FOR_ACCEPTANCE',
          amount: 32000,
          approvedAt: '2026-10-17T12:00:00+09:00',
          canceledAt: state.status === 'COMPLETED' ? '2026-10-17T13:00:00+09:00' : null,
          couponMultiplier: null,
          couponStatus: null,
          expectedRewardAmount: 50000,
          rewardAmount: null,
        },
      },
    });
  });
  await page.route(`**/payments/${orderId}/cancellations`, (route) => {
    state.postCalls++;
    state.idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    if (state.responseMode === '409') {
      state.status = 'PENDING';
      state.failureCode = 'CANCELLATION_RESULT_UNCONFIRMED';
      return route.fulfill({
        status: 409,
        json: { message: '취소가 진행 중입니다.', error: { code: 'CANCELLATION_IN_PROGRESS' } },
      });
    }
    if (state.responseMode === '202') {
      state.status = 'PENDING';
      state.failureCode = 'CANCELLATION_RESULT_UNCONFIRMED';
      return route.fulfill({
        status: 202,
        json: {
          data: {
            orderId,
            paymentStatus: 'COMPLETED',
            cancellationId: 901,
            cancellationStatus: 'PENDING',
            cancellationFailureCode: state.failureCode,
            statusUrl: `/payments/${orderId}`,
            retryAfterSeconds: 5,
          },
        },
      });
    }
    state.status = 'COMPLETED';
    state.failureCode = null;
    return route.fulfill({
      status: 201,
      json: { data: { orderId, paymentStatus: 'CANCELED', giftId: 501, giftStatus: 'CANCELED' } },
    });
  });
  await page.route('**/gifts/received/401/accept', (route) => {
    state.acceptCalls++;
    return route.fulfill({
      json: { data: { giftId: 401, giftStatus: 'COMPLETED', rewardAmount: 50000 } },
    });
  });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  return state;
}

test('취소 202를 진행 중으로 표시하고 GET 완료 확인 전에는 성공 처리하지 않는다', async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole('button', { name: /보낸 선물/ }).click();
  const item = page.locator('.gift-history-item').first();
  const cancelButton = item.getByRole('button', { name: '선물 취소', exact: true });
  await expect(cancelButton).toBeEnabled();
  await cancelButton.click();
  const confirm = page
    .getByRole('dialog', { name: '선물을 취소할까요?' })
    .getByRole('button', { name: '취소하기' });
  await confirm.evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  await expect(page.locator('.gift-cancellation-status')).toContainText(
    '취소 결과가 아직 확정되지 않았어요.',
  );
  await expect(page.locator('.gift-cancellation-status')).toContainText('취소 원장 901');
  await expect(page.getByText('선물 결제를 취소했습니다.', { exact: true })).toHaveCount(0);
  expect(state.postCalls).toBe(1);
  await page.screenshot({ path: '/private/tmp/cancellation-pending-list.png', fullPage: true });

  state.status = 'COMPLETED';
  state.failureCode = null;
  await page
    .locator('.gift-cancellation-status')
    .getByRole('button', { name: '취소 상태 확인' })
    .click();
  await expect(item).toContainText('취소됨');
  await expect(item.getByRole('button', { name: '선물 취소' })).toHaveCount(0);
  expect(state.postCalls).toBe(1);
});

test('409 CANCELLATION_IN_PROGRESS는 기존 취소 상태로 전환하고 추가 POST를 막는다', async ({
  page,
}) => {
  const state = await setup(page);
  state.responseMode = '409';
  await page.getByRole('button', { name: /보낸 선물/ }).click();
  const item = page.locator('.gift-history-item').first();
  await item.getByRole('button', { name: '선물 취소', exact: true }).click();
  await page
    .getByRole('dialog', { name: '선물을 취소할까요?' })
    .getByRole('button', { name: '취소하기' })
    .click();

  await expect(page.locator('.gift-cancellation-status')).toContainText(
    '취소 결과가 아직 확정되지 않았어요.',
  );
  await expect(item.getByRole('button', { name: '선물 취소' })).toHaveCount(0);
  expect(state.postCalls).toBe(1);
});

test('재진입 시 발신자 취소 상태를 복원하고 받은 선물에는 결제자 상태 조회를 요구하지 않는다', async ({
  page,
}) => {
  const state = await setup(page, 'PENDING');
  const sentButton = page.getByRole('button', { name: /보낸 선물/ });
  await sentButton.click();
  await expect(page.locator('.gift-cancellation-status')).toContainText(
    '취소 결과가 아직 확정되지 않았어요.',
  );
  await page.locator('.gift-history-card').first().click();
  await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  await expect(page.locator('.gift-cancellation-status')).toContainText('취소 원장 901');
  await expect(page.getByRole('button', { name: '선물 취소' })).toHaveCount(0);
  await page.screenshot({ path: '/private/tmp/cancellation-pending-detail.png', fullPage: true });

  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  const statusCallsBeforeReceived = state.statusCalls;
  await page.getByRole('button', { name: /받은 선물/ }).click();
  await expect(page.locator('.gift-cancellation-status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '선물 받기' })).toBeEnabled();
  expect(state.statusCalls).toBe(statusCallsBeforeReceived);

  await page.locator('.gift-history-card').first().click();
  await expect(page.getByRole('heading', { name: '받은 선물 상세' })).toBeVisible();
  await expect(page.locator('.gift-cancellation-status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '선물 받기' })).toBeEnabled();
  expect(state.statusCalls).toBe(statusCallsBeforeReceived);
  expect(state.acceptCalls).toBe(0);
  expect(state.postCalls).toBe(0);
});

test('받은 선물 상세는 결제 상태 조회 없이 수락 API를 호출한다', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: /받은 선물/ }).click();
  const statusCallsBeforeReceived = state.statusCalls;
  await page.locator('.gift-history-card').first().click();

  await expect(page.getByRole('heading', { name: '받은 선물 상세' })).toBeVisible();
  await page.getByRole('button', { name: '선물 받기' }).click();
  await expect.poll(() => state.acceptCalls).toBe(1);
  expect(state.statusCalls).toBe(statusCallsBeforeReceived);
});

test('취소 거절이 확정된 뒤 다시 요청하면 새 멱등 키를 사용한다', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: /보낸 선물/ }).click();
  const item = page.locator('.gift-history-item').first();
  await item.getByRole('button', { name: '선물 취소', exact: true }).click();
  await page
    .getByRole('dialog', { name: '선물을 취소할까요?' })
    .getByRole('button', { name: '취소하기' })
    .click();
  await expect(item).toContainText('취소 결과가 아직 확정되지 않았어요.');

  state.status = 'DECLINED';
  state.failureCode = 'CANCELLATION_DECLINED';
  await item
    .locator('.gift-cancellation-status')
    .getByRole('button', { name: '취소 상태 확인' })
    .click();
  await expect(item).toContainText('취소 요청이 거절됐어요.');
  await item.getByRole('button', { name: '취소 다시 요청' }).click();
  await page
    .getByRole('dialog', { name: '선물을 취소할까요?' })
    .getByRole('button', { name: '취소하기' })
    .click();

  expect(state.postCalls).toBe(2);
  expect(state.idempotencyKeys[0]).toBeTruthy();
  expect(state.idempotencyKeys[1]).toBeTruthy();
  expect(state.idempotencyKeys[1]).not.toBe(state.idempotencyKeys[0]);
});

test('취소 거절과 운영 확인 상태를 서로 다른 문구와 동작으로 표시한다', async ({ page }) => {
  const state = await setup(page, 'DECLINED');
  state.failureCode = 'CANCELLATION_DECLINED';
  await page.getByRole('button', { name: /보낸 선물/ }).click();
  await expect(page.locator('.gift-cancellation-status')).toContainText('취소 요청이 거절됐어요.');
  await expect(page.getByRole('button', { name: '취소 다시 요청' })).toBeEnabled();

  state.status = 'PENDING';
  state.failureCode = 'CANCELLATION_RECONCILIATION_REQUIRED';
  await page.reload();
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await page.getByRole('button', { name: /보낸 선물/ }).click();
  await expect(page.locator('.gift-cancellation-status')).toContainText(
    '취소 결과를 운영자가 확인하고 있어요.',
  );
  await expect(page.getByRole('button', { name: '선물 취소' })).toHaveCount(0);
});
