import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
  });
  await page.goto('/');
});

test('친구를 먼저 선택한 사용자가 상품 수량을 정하고 선물을 완료한다', async ({ page }) => {
  const recipient = page.locator('.friend-card').filter({ hasText: '김민지' }).first();
  await recipient.getByRole('button', { name: '선물하기' }).click();

  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'gifts');

  await page.locator('.product-card').nth(2).click();
  await expect(page.getByRole('heading', { name: '상품 상세' })).toBeVisible();
  await expect(page.getByText('포근한 데일리 선물 세트', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '수량 늘리기' }).click();
  await expect(page.locator('.quantity-row strong')).toHaveText('2');
  await expect(page.getByRole('button', { name: /선물하기 64,000원/ })).toBeVisible();
  await page.getByRole('button', { name: /선물하기 64,000원/ }).click();

  await expect(page.getByRole('heading', { name: '완료' })).toBeVisible();
  await expect(page.locator('.summary-card')).toContainText('김민지');
  await expect(page.locator('.summary-card')).toContainText('2개');
  await expect(page.locator('.summary-card')).toContainText('64,000원');

  await page.getByRole('button', { name: '친구 화면으로' }).click();
  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
});

test('사용자가 상품을 검색하고 상세 화면에서 목록으로 돌아간다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();

  await page.getByPlaceholder('상품명을 입력해 주세요.').fill('프리미엄 티 세트');
  const products = page.locator('.product-card');
  await expect(products).toHaveCount(15);
  await products.first().click();

  await expect(page.getByRole('heading', { name: '상품 상세' })).toBeVisible();
  await expect(page.getByText('프리미엄 티 세트', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '뒤로 가기' }).click();

  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();
});

test('사용자가 카테고리 필터를 적용한다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  await page.getByRole('button', { name: '필터' }).click();

  await expect(page.getByRole('heading', { name: '카테고리 필터' })).toBeVisible();
  await page.getByRole('button', { name: '뷰티' }).click();
  await page.getByRole('button', { name: '적용하기' }).click();

  await expect(page.getByRole('button', { name: '필터, 1개 선택됨' })).toBeVisible();
});

test.fixme('상품을 먼저 선택한 사용자가 받는 친구를 선택한 뒤 선물을 완료한다', async () => {
  // 현재 수신자 미선택 안내 후 친구 화면으로 이동하지만 선택했던 상품 흐름으로 복귀하지 않는다.
  // 친구 선택 뒤 기존 상품 상세로 돌아오는 흐름이 구현되면 실제 사용자 시나리오로 작성한다.
});
