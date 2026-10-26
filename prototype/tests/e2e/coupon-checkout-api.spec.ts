import { expect, type Page, test } from '@playwright/test';

import { setupGiftErrorRoutes } from './gift-error-fixture';

const orderId = '550e8400-e29b-41d4-a716-446655440000';

async function setup(page: Page, available = [2, 3]) {
  await page.addInitScript(() => {
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'prototype-test-token');
    localStorage.setItem(
      'authUser',
      JSON.stringify({ userId: 1, name: '홍길동', email: 'me@example.com' }),
    );
  });
  await setupGiftErrorRoutes(page, {
    quantity: 1,
    status: 422,
    code: 'PAYMENT_DECLINED',
    message: '결제가 거절되었습니다.',
  });
  const state = {
    available,
    couponError: false,
    unavailableOnce: false,
    networkOnce: false,
    rejectRetry: false,
    delayPayment: 0,
    pending: false,
    paid: false,
    canceled: false,
    selected: null as number | null,
    couponCalls: 0,
    posts: [] as { body: Record<string, unknown>; key?: string }[],
    keys: new Set<string>(),
  };
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 1,
          name: '홍길동',
          email: 'me@example.com',
          creditBalance: 468000,
          isBirthdayPublic: false,
          giftSummary: { sentCount: 1, receivedCount: 0 },
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
  await page.route('**/coupons', (route) => {
    state.couponCalls++;
    return route.fulfill(
      state.couponError
        ? {
            status: 500,
            json: {
              message: '쿠폰 조회를 실패했습니다.',
              error: { code: 'INTERNAL_SERVER_ERROR' },
            },
          }
        : {
            json: {
              data: {
                baseRewardAmount: 50000,
                coupons: state.available.map((multiplier) => ({ multiplier, quantity: 1 })),
              },
            },
          },
    );
  });
  const gift = () => ({
    giftId: 501,
    orderId,
    giftStatus: state.canceled ? 'CANCELED' : state.paid ? 'COMPLETED' : 'WAITING_FOR_ACCEPTANCE',
    expiresAt: '2027-01-01T00:00:00+09:00',
    sentAt: '2026-10-26T12:00:00+09:00',
    recipient: { userId: 27, name: '김민지' },
    product: {
      productId: 101,
      name: '포근한 데일리 선물 세트',
      brand: '선잘알 셀렉트',
      imageUrl: '',
    },
    quantity: 1,
    unitPrice: 32000,
    totalPrice: 32000,
  });
  const reward = () => ({
    couponMultiplier: state.selected,
    couponStatus: state.selected ? (state.canceled ? 'RESTORED' : 'USED') : null,
    expectedRewardAmount:
      state.pending || state.paid || state.canceled ? null : 50000 * (state.selected ?? 1),
    rewardAmount: state.paid ? 50000 * (state.selected ?? 1) : null,
  });
  await page.route('**/gifts/sent/501', (route) => route.fulfill({ json: { data: gift() } }));
  await page.route(`**/payments/${orderId}`, (route) =>
    route.fulfill({
      json: {
        data: {
          orderId,
          paymentStatus: state.pending ? 'PENDING' : state.canceled ? 'CANCELED' : 'COMPLETED',
          giftId: state.pending ? null : 501,
          giftStatus: gift().giftStatus,
          ...reward(),
        },
      },
    }),
  );
  await page.route(`**/payments/${orderId}/cancellations`, (route) => {
    state.canceled = true;
    if (state.selected && !state.available.includes(state.selected))
      state.available.push(state.selected);
    return route.fulfill({
      json: { data: { orderId, paymentStatus: 'CANCELED', giftId: 501, giftStatus: 'CANCELED' } },
    });
  });
  await page.route(/\/payments$/, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const key = route.request().headers()['idempotency-key'];
    state.posts.push({ body, key });
    if (state.rejectRetry && state.posts.length > 1)
      return route.fulfill({
        status: 400,
        json: {
          message: '요청값을 확인해 주세요.',
          error: { code: 'INVALID_REQUEST' },
        },
      });
    if (state.delayPayment) await new Promise((resolve) => setTimeout(resolve, state.delayPayment));
    if (state.unavailableOnce) {
      state.unavailableOnce = false;
      state.available = state.available.filter((item) => item !== body.couponMultiplier);
      return route.fulfill({
        status: 422,
        json: {
          message: '선택한 쿠폰의 사용 가능 수량이 부족합니다.',
          error: { code: 'COUPON_NOT_AVAILABLE' },
        },
      });
    }
    state.selected = (body.couponMultiplier as number | undefined) ?? null;
    const first = !state.keys.has(key!);
    state.keys.add(key!);
    state.available = state.available.filter((item) => item !== state.selected);
    if (state.networkOnce) {
      state.networkOnce = false;
      return route.abort('failed');
    }
    if (state.pending)
      return route.fulfill({
        status: 202,
        json: {
          data: {
            orderId,
            paymentStatus: 'PENDING',
            approvalResult: 'UNKNOWN',
            retryAfterSeconds: 5,
          },
        },
      });
    return route.fulfill({
      status: first ? 201 : 200,
      json: {
        data: {
          orderId,
          paymentKey: 'payment-key',
          transactionKey: 'transaction-key',
          paymentStatus: 'COMPLETED',
          giftId: 501,
          giftStatus: gift().giftStatus,
          amount: 32000,
          balanceAfter: 468000,
          approvedAt: '2026-10-26T12:00:00+09:00',
          giftExpiresAt: gift().expiresAt,
          ...reward(),
        },
      },
    });
  });
  return state;
}

async function checkout(page: Page) {
  await page.goto('/');
  await page
    .locator('.friend-card')
    .filter({ hasText: '김민지' })
    .first()
    .getByRole('button', { name: '선물하기' })
    .click();
  await page.locator('.product-card').first().click();
  await page.getByRole('button', { name: /선물하기 32,000원/ }).click();
  const sheet = page.getByRole('dialog', { name: /이 선물을 보낼까요/ });
  await expect(sheet.getByRole('radio', { name: '사용하지 않음' })).toBeChecked();
  return sheet;
}

for (const multiplier of [null, 2, 3]) {
  test(`미사용·${multiplier ?? 1}배 결제 후 상세와 새로고침에서 미지급·실제 지급액을 구분한다`, async ({
    page,
  }) => {
    const state = await setup(page);
    const sheet = await checkout(page);
    if (multiplier)
      await sheet.getByRole('radio', { name: new RegExp(`${multiplier}배 쿠폰`) }).check();
    await expect(sheet.locator('.checkout-reward strong')).toHaveText(
      `${(50000 * (multiplier ?? 1)).toLocaleString()} 크레딧`,
    );
    await expect(sheet.locator('.checkout-price')).toContainText('32,000원');
    await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
    await expect(page.locator('.gift-reward-summary')).toContainText(
      '상대방이 선물을 수락하면 지급됩니다.',
    );
    expect(state.posts[0].body.couponMultiplier ?? null).toBe(multiplier);
    await page.reload();
    await expect(page.locator('.gift-reward-heading')).toContainText('수락 대기');
    state.paid = true;
    await expect(page.getByRole('button', { name: '보상 상태 새로고침' })).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.gift-reward-heading')).toContainText('지급 완료');
    await expect(page.locator('.gift-reward-summary')).toContainText('지급된 보상');
    expect(state.posts).toHaveLength(1);
  });
}

for (const available of [[], [2], [3]]) {
  test(`보유 ${available.join(',') || '없음'} 목록만 표시하고 쿠폰 없이도 결제한다`, async ({
    page,
  }) => {
    await setup(page, available);
    const sheet = await checkout(page);
    await expect(sheet.getByRole('radio')).toHaveCount(available.length + 1);
    if (!available.length) await expect(sheet).toContainText('사용 가능한 쿠폰이 없습니다');
    await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  });
}

test('쿠폰 조회 실패를 미보유와 구분하고 쿠폰 없이 결제할 수 있다', async ({ page }) => {
  const state = await setup(page);
  state.couponError = true;
  const sheet = await checkout(page);
  await expect(sheet).toContainText('쿠폰 조회를 실패했습니다.');
  await expect(sheet.getByText('사용 가능한 쿠폰이 없습니다.')).toHaveCount(0);
  await sheet.getByRole('button', { name: '쿠폰 없이 선물 보내기' }).click();
  await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  expect(state.posts[0].body).not.toHaveProperty('couponMultiplier');
});

test('쿠폰 부족 확정은 목록을 갱신하고 변경한 선택에는 새 키를 사용한다', async ({ page }) => {
  const state = await setup(page);
  state.unavailableOnce = true;
  const sheet = await checkout(page);
  await sheet.getByRole('radio', { name: /2배 쿠폰/ }).check();
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
  await expect(sheet).toContainText('선택한 쿠폰의 사용 가능 수량이 부족합니다.');
  await expect(sheet.getByRole('radio', { name: /2배 쿠폰/ })).toHaveCount(0);
  await sheet.getByRole('radio', { name: /3배 쿠폰/ }).check();
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  expect(state.posts).toHaveLength(2);
  expect(state.posts[1].key).not.toBe(state.posts[0].key);
});

test('응답 유실·새로고침에도 자동 재결제 없이 동일 키·쿠폰으로 수동 재시도한다', async ({
  page,
}) => {
  const state = await setup(page);
  state.networkOnce = true;
  const sheet = await checkout(page);
  await sheet.getByRole('radio', { name: /3배 쿠폰/ }).check();
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
  await expect(sheet.getByRole('button', { name: '같은 결제 결과 확인' })).toBeEnabled();
  await expect(sheet.getByRole('radio', { name: '사용하지 않음' })).toBeDisabled();
  await page.reload();
  const restored = page.getByRole('dialog', { name: /이 선물을 보낼까요/ });
  await expect(restored.getByRole('radio', { name: /3배 쿠폰/ })).toBeChecked();
  expect(state.posts).toHaveLength(1);
  await restored.getByRole('button', { name: '같은 결제 결과 확인' }).click();
  await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  expect(state.posts).toHaveLength(2);
  expect(state.posts[1]).toEqual(state.posts[0]);
  expect(state.keys.size).toBe(1);
});

test('202 응답 뒤에는 수동 상태 조회로 완료하고 결제 명령을 다시 보내지 않는다', async ({
  page,
}) => {
  const state = await setup(page);
  state.pending = true;
  const sheet = await checkout(page);
  await sheet.getByRole('radio', { name: /2배 쿠폰/ }).check();
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
  await expect(sheet).toContainText('결제 결과를 확인 중입니다.');
  state.pending = false;
  await sheet.getByRole('button', { name: '같은 결제 결과 확인' }).click();
  await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  expect(state.posts).toHaveLength(1);
});

test('미수락 취소 후 서버가 확정한 쿠폰 복구와 보상 미지급을 표시한다', async ({ page }) => {
  await setup(page);
  const sheet = await checkout(page);
  await sheet.getByRole('radio', { name: /2배 쿠폰/ }).check();
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
  await page.getByRole('button', { name: '선물 취소', exact: true }).click();
  await page
    .getByRole('dialog', { name: '선물을 취소할까요?' })
    .getByRole('button', { name: '취소하기' })
    .click();
  await expect(page.locator('.gift-reward-summary')).toContainText('사용한 쿠폰이 복구되었습니다.');
  await expect(page.locator('.gift-reward-heading')).toContainText('미지급');
});

test('앞선 응답 유실 뒤 재요청이 400이어도 쿠폰 선택과 기존 요청을 유지한다', async ({ page }) => {
  const state = await setup(page);
  state.networkOnce = true;
  state.rejectRetry = true;
  const sheet = await checkout(page);
  await sheet.getByRole('radio', { name: /2배 쿠폰/ }).check();
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
  await sheet.getByRole('button', { name: '같은 결제 결과 확인' }).click();
  await expect(sheet).toContainText('요청값을 확인해 주세요.');
  await expect(sheet.getByRole('radio', { name: '사용하지 않음' })).toBeDisabled();
  expect(state.posts[1]).toEqual(state.posts[0]);
  expect(await page.evaluate(() => Boolean(sessionStorage.getItem('gift-pending-checkout')))).toBe(
    true,
  );
});

test('닫은 미확정 결제는 안내 버튼으로 복원하며 중복 클릭에도 한 번만 전송한다', async ({
  page,
}) => {
  const state = await setup(page);
  state.pending = true;
  const sheet = await checkout(page);
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).click();
  await expect(sheet).toContainText('결제 결과를 확인 중입니다.');
  await sheet.getByRole('button', { name: '결제 확인 닫기' }).click();
  await page.getByRole('button', { name: '같은 결제 확인', exact: true }).click();
  await expect(sheet.getByRole('radio', { name: '사용하지 않음' })).toBeDisabled();
  state.pending = false;
  await sheet.getByRole('button', { name: '같은 결제 결과 확인' }).click();
  await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  expect(state.posts).toHaveLength(1);
});

test('모바일 쿠폰 시트는 가로 넘침 없이 표시되고 결제 버튼 중복 클릭을 막는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page);
  state.delayPayment = 700;
  const sheet = await checkout(page);
  await sheet.getByRole('radio', { name: /2배 쿠폰/ }).check();
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).scrollIntoViewIfNeeded();
  const bounds = await sheet.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '/private/tmp/coupon-checkout-mobile.png' });
  await sheet.getByRole('button', { name: '선물 보내기', exact: true }).dblclick();
  await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  await expect(page.locator('.gift-reward-summary')).toContainText('100,000 크레딧');
  const quickMenu = page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' });
  await expect(quickMenu).toHaveCount(1);
  await expect(
    page.locator('.screen-header').getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }),
  ).toBeVisible();
  const menuBounds = await quickMenu.boundingBox();
  const rewardBounds = await page.locator('.gift-reward-summary').boundingBox();
  expect(menuBounds!.y + menuBounds!.height).toBeLessThan(rewardBounds!.y);
  await expect(page.getByRole('button', { name: '보상 상태 새로고침' })).toHaveCount(0);
  await page.screenshot({ path: '/private/tmp/coupon-result-mobile.png' });
  expect(state.posts).toHaveLength(1);
});
