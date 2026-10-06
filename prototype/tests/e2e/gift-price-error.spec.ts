import { expect, test } from '@playwright/test';

import { setupGiftErrorRoutes } from './gift-error-fixture';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
  });
});

test('가격 변경 안내 후 재시도에도 같은 idempotency key를 사용한다', async ({ page }) => {
  const requests = await setupGiftErrorRoutes(page, {
    quantity: 1,
    status: 409,
    code: 'GIFT_CONDITIONS_CHANGED',
    message: '상품 가격이 변경되었습니다. 다시 확인해 주세요.',
  });

  await page.goto('/');
  await page
    .locator('.friend-card')
    .filter({ hasText: '김민지' })
    .first()
    .getByRole('button', { name: '선물하기' })
    .click();
  await page.locator('.product-card').first().click();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('button', { name: /선물하기 32,000원/ }).click();
    await page
      .getByRole('dialog', { name: /이 선물을 보낼까요/ })
      .getByRole('button', { name: '선물 보내기' })
      .click();
    const dialog = page.getByRole('dialog', { name: '가격이 변경됐어요' });
    await expect(dialog).toContainText('상품 상세에서 최신 가격을 다시 확인해 주세요.');
    if (attempt === 0) await dialog.getByRole('button', { name: '다시 확인하러 가기' }).click();
  }

  expect(requests).toHaveLength(2);
  expect(requests[0].body).toMatchObject({
    productId: 101,
    recipientUserId: 27,
    quantity: 1,
    expectedUnitPrice: 32000,
  });
  expect(requests[0].idempotencyKey).toBeTruthy();
  expect(requests[1].idempotencyKey).toBe(requests[0].idempotencyKey);
});
