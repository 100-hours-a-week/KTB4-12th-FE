import { expect, test } from '@playwright/test';

const recipient = {
  friendId: 31,
  userId: 27,
  name: '김민지',
  email: 'friend1@gift.local',
  birth: '2000-01-01',
};

const product = {
  productId: 101,
  brandName: '선잘알 셀렉트',
  productName: '포근한 데일리 선물 세트',
  price: 32000,
  thumbnailUrl: '',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
  });
});

test('사전 검증 후 재고가 부족해지면 선물을 완료하지 않고 안내를 표시한다', async ({ page }) => {
  const createRequests: Array<{ body: unknown; idempotencyKey: string | undefined }> = [];

  await page.route('**/products/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: '카테고리를 조회했습니다.', data: { categories: [] } }),
    });
  });
  await page.route(/\/friends(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '친구 목록을 조회했습니다.',
        data: { friends: [recipient], pagination: { nextCursor: null, hasNext: false } },
      }),
    });
  });
  await page.route(/\/products(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '상품을 조회했습니다.',
        data: {
          products: [product],
          pagination: { nextCursor: null, hasNext: false },
          appliedSort: 'AI_RECOMMENDED',
        },
      }),
    });
  });
  await page.route('**/products/101', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '상품 상세를 조회했습니다.',
        data: {
          product: {
            productId: 101,
            brandName: '선잘알 셀렉트',
            productName: '포근한 데일리 선물 세트',
            description: '선물하기 좋은 상품입니다.',
            unitPrice: 32000,
            images: [],
            stockQuantity: 8,
          },
        },
      }),
    });
  });
  await page.route('**/gifts/preflight', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '선물 조건을 확인했습니다.',
        data: {
          recipient: { userId: 27, name: '김민지' },
          product: {
            productId: 101,
            unitPrice: 32000,
            quantity: 2,
            totalPrice: 64000,
            maxOrderQuantity: 5,
          },
          preferenceWarning: null,
        },
      }),
    });
  });
  await page.route(/\/gifts$/, async (route) => {
    createRequests.push({
      body: route.request().postDataJSON(),
      idempotencyKey: route.request().headers()['idempotency-key'],
    });
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '상품 재고가 부족합니다.',
        error: {
          code: 'INSUFFICIENT_STOCK',
          traceId: '01JXYZ8D7G5K2M4N6P8Q',
        },
      }),
    });
  });

  await page.goto('/');
  const friendCard = page.locator('.friend-card').filter({ hasText: '김민지' });
  await friendCard.getByRole('button', { name: '선물하기' }).click();
  await page.locator('.product-card').click();
  await page.getByRole('button', { name: '수량 늘리기' }).click();
  await page.getByRole('button', { name: /선물하기 64,000원/ }).click();

  await expect(page.getByRole('alert')).toHaveText('상품 재고가 부족합니다.');
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(page.getByRole('button', { name: '친구 화면으로' })).toBeVisible();
  await expect(page.locator('.summary-card')).toHaveCount(0);
  await expect(page.getByText(/선물이 전달됐어요/)).toHaveCount(0);
  expect(createRequests.length).toBeGreaterThan(0);
  for (const request of createRequests) {
    expect(request.body).toMatchObject({
      productId: 101,
      recipientUserId: 27,
      quantity: 2,
      expectedUnitPrice: 32000,
    });
    expect(request.idempotencyKey).toBeTruthy();
  }
  expect(new Set(createRequests.map((request) => request.idempotencyKey)).size).toBe(1);
});
