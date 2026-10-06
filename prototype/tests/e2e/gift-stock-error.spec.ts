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

test('재고 부족이면 완료 화면 대신 수량 재확인 안내를 표시한다', async ({ page }) => {
  await setupGiftErrorRoutes(page, {
    quantity: 2,
    status: 422,
    code: 'INSUFFICIENT_STOCK',
    message: '상품 재고가 부족합니다.',
  });

  await page.goto('/');
  await page
    .locator('.friend-card')
    .filter({ hasText: '김민지' })
    .first()
    .getByRole('button', { name: '선물하기' })
    .click();
  await page.locator('.product-card').first().click();
  await page.getByRole('button', { name: '수량 늘리기' }).click();
  await page.getByRole('button', { name: /선물하기 64,000원/ }).click();
  await page
    .getByRole('dialog', { name: /이 선물을 보낼까요/ })
    .getByRole('button', { name: '선물 보내기' })
    .click();

  const dialog = page.getByRole('dialog', { name: '재고가 부족해요' });
  await expect(dialog).toContainText('상품 상세에서 수량을 다시 확인해 주세요.');
  await expect(dialog.getByRole('button', { name: '다시 확인하러 가기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '완료' })).toHaveCount(0);
});
