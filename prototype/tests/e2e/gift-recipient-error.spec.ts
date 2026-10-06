import { expect, test } from '@playwright/test';

test('[QA 선물하기 4] 선택창을 열 때 친구를 조회하고 재진입 후 상품·수량을 유지한다', async ({
  page,
}) => {
  const friend = {
    friendId: 31,
    userId: 27,
    name: '김민지',
    email: 'friend@gift.local',
    birth: null,
  };
  const product = {
    productId: 101,
    brandName: '선잘알',
    productName: '선물 세트',
    price: 32000,
    thumbnailUrl: null,
  };
  const pagination = { nextCursor: null, hasNext: false };
  const friendRequests: string[] = [];
  const giftRequests: unknown[] = [];

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
    window.localStorage.setItem('gift-prototype-main-tab', 'gifts');
  });
  await page.route('**/products/categories', (route) =>
    route.fulfill({
      json: {
        message: '카테고리를 조회했습니다.',
        data: { categories: [] },
      },
    }),
  );
  await page.route(/\/products(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        message: '상품을 조회했습니다.',
        data: { products: [product], pagination, appliedSort: 'POPULAR' },
      },
    }),
  );
  await page.route('**/products/101', (route) =>
    route.fulfill({
      json: {
        message: '상품 상세를 조회했습니다.',
        data: {
          product: {
            ...product,
            unitPrice: product.price,
            description: '선물 세트',
            images: [],
            stockQuantity: 8,
          },
        },
      },
    }),
  );
  await page.route(/\/friends(?:\/search)?(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    friendRequests.push(url.pathname + url.search);
    return route.fulfill({
      json: {
        message: '친구 목록을 조회했습니다.',
        data: {
          friends: [{ ...friend, name: friendRequests.length > 1 ? '박서연' : friend.name }],
          pagination,
        },
      },
    });
  });
  await page.route('**/gifts/preflight', (route) =>
    route.fulfill({
      json: {
        message: '선물 조건을 확인했습니다.',
        data: {
          recipient: { userId: friend.userId, name: '박서연' },
          product: {
            productId: product.productId,
            unitPrice: product.price,
            quantity: 2,
            totalPrice: 64000,
            maxOrderQuantity: 5,
          },
          preferenceWarning: null,
        },
      },
    }),
  );
  await page.route(/\/gifts$/, (route) => {
    giftRequests.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201,
      json: {
        message: '선물을 보냈습니다.',
        data: {
          gift: {
            giftId: 501,
            sentAt: '2026-09-30T12:00:00+09:00',
            recipientName: '박서연',
            product: {
              productName: product.productName,
              quantity: 2,
              unitPrice: product.price,
              totalPrice: 64000,
              imageUrl: null,
            },
          },
        },
      },
    });
  });

  await page.goto('/');
  await page.locator('.product-card').first().click();
  await page.getByRole('button', { name: '수량 늘리기' }).click();
  expect(friendRequests).toEqual([]);
  await page.getByRole('button', { name: /선물하기 64,000원/ }).click();

  const sheet = page.getByRole('dialog', { name: '받는 사람 선택' });
  await expect(sheet.locator('.friend-card')).toBeVisible();
  const firstOpenRequestCount = friendRequests.length;
  expect(firstOpenRequestCount).toBeGreaterThan(0);
  await sheet.getByRole('button', { name: '받는 사람 선택 닫기' }).click();
  await expect(sheet).not.toBeVisible();
  await page.getByRole('button', { name: /선물하기 64,000원/ }).click();
  await expect(sheet.locator('.friend-card')).toBeVisible();
  expect(friendRequests.length).toBeGreaterThan(firstOpenRequestCount);
  await sheet.getByRole('button', { name: '선택', exact: true }).click();

  const confirmDialog = page.getByRole('dialog', { name: /이 선물을 보낼까요/ });
  await confirmDialog.getByRole('button', { name: '선물 보내기' }).click();

  await expect(page.locator('.summary-card')).toContainText('박서연');
  await expect(page.locator('.delivery-message')).toContainText('선물 세트');
  await expect(page.locator('.summary-card')).toContainText('2개');
  await expect(page.locator('.summary-card')).toContainText('64,000원');
  expect(giftRequests.length).toBeGreaterThan(0);
  for (const request of giftRequests) {
    expect(request).toEqual({
      productId: 101,
      recipientUserId: 27,
      quantity: 2,
      expectedUnitPrice: 32000,
    });
  }
});
