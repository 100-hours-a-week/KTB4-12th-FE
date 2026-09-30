import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
  });
  await page.goto('/');
});

test('[QA 75, 77, 79, 88] 친구를 먼저 선택해 선물을 완료하고 상태를 초기화한다', async ({
  page,
}) => {
  const recipient = page.locator('.friend-card').filter({ hasText: '김민지' }).first();
  await recipient.getByRole('button', { name: '선물하기' }).click();

  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'gifts');

  await page.locator('.product-card').nth(2).click();
  await expect(page.getByRole('heading', { name: '상품 상세' })).toBeVisible();
  await expect(
    page.locator('.product-detail').getByText('포근한 데일리 선물 세트', { exact: true }),
  ).toBeVisible();

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

test('[QA 77] 선물 사전 검증 중 처리 중 상태를 표시한다', async ({ page }) => {
  const recipient = page.locator('.friend-card').filter({ hasText: '김민지' }).first();
  await recipient.getByRole('button', { name: '선물하기' }).click();
  await page.locator('.product-card').nth(2).click();

  await page.getByRole('button', { name: /선물하기/ }).click();

  await expect(page.getByRole('heading', { name: '완료' })).toBeVisible();
  await expect(page.getByText('선물을 전달하는 중', { exact: true })).toBeVisible();
  await expect(page.locator('.loading-dot')).toBeVisible();
  await expect(page.locator('.summary-card')).toHaveCount(0);
  await expect(page.getByText(/선물이 전달됐어요/)).toHaveCount(0);

  await expect(page.locator('.summary-card')).toBeVisible();
  await expect(page.locator('.summary-card')).toContainText('김민지');
});

test('사용자가 상품을 검색하고 상세 화면에서 목록으로 돌아간다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();

  await page.getByPlaceholder('상품명 또는 브랜드를 입력해 주세요.').fill('프리미엄 티 세트');
  const products = page.locator('.product-card');
  await expect(products).toHaveCount(15);
  await products.first().click();

  await expect(page.getByRole('heading', { name: '상품 상세' })).toBeVisible();
  await expect(
    page.locator('.product-detail').getByText('프리미엄 티 세트', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '뒤로 가기' }).click();

  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();
});

test('상품 목록 이미지는 같은 크기의 카드 이미지 영역을 빈틈없이 채운다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  const imageArea = page.locator('.product-card-image').first();
  const image = imageArea.locator('img');
  await expect(image).toBeVisible();

  const areaBox = await imageArea.boundingBox();
  const imageBox = await image.boundingBox();
  expect(areaBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.width).toBeGreaterThanOrEqual(areaBox!.width);
  expect(imageBox!.height).toBeGreaterThanOrEqual(areaBox!.height);

  const imageAreaSizes = await page.locator('.product-card-image').evaluateAll((areas) =>
    areas.map((area) => {
      const { width, height } = area.getBoundingClientRect();
      return `${width}:${height}`;
    }),
  );
  expect(new Set(imageAreaSizes).size).toBe(1);
});

test('상품 목록의 스크롤 영역을 다른 메인 탭과 공유하지 않는다', async ({ page }) => {
  const navigation = page.getByRole('navigation', { name: '하단 메뉴' });
  const scroll = page.getByTestId('mobile-scroll');

  await navigation.getByRole('button', { name: '선물' }).click();
  await expect(page.locator('.product-card').first()).toBeVisible();
  await scroll.evaluate((element) => {
    element.dataset.tabScroll = 'gifts';
    element.scrollTop = element.scrollHeight;
  });

  await navigation.getByRole('button', { name: '마이' }).click();
  await expect(page.locator('.mypage-page')).toBeVisible();
  await expect(scroll).not.toHaveAttribute('data-tab-scroll');
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);
});

test('작은 실기기에서도 마이페이지에 불필요한 스크롤이 생기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();

  await expect(page.locator('.mypage-page')).toBeVisible();
  const size = await page.getByTestId('mobile-scroll').evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight + 1);
});

test('공백만 입력한 상품명으로는 검색하지 않는다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();

  await page.getByPlaceholder('상품명 또는 브랜드를 입력해 주세요.').fill('   ');
  await page.waitForTimeout(400);

  await expect(page.locator('.product-card')).toHaveCount(20);
});

test('새로고침 후에도 현재 메인 탭을 유지한다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'gifts');
  await expect(
    page.getByRole('navigation', { name: '하단 메뉴' }).getByRole('button', { name: '선물' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('상품 상세에서 돌아가면 선물 목록의 스크롤 위치를 복원한다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();

  await expect(page.locator('.product-card')).toHaveCount(20);
  const scroll = page.getByTestId('mobile-scroll');
  await scroll.evaluate((element) => {
    element.dataset.listScroll = 'true';
    element.scrollTo({ top: 360 });
  });
  const before = await scroll.evaluate((element) => element.scrollTop);
  expect(before).toBeGreaterThan(0);

  await page
    .locator('.product-card')
    .nth(10)
    .evaluate((element: HTMLElement) => element.click());
  await expect(page.getByRole('heading', { name: '상품 상세' })).toBeVisible();
  await expect(page.getByTestId('mobile-scroll')).toHaveCount(2);
  await expect(
    page.locator('.route-preserved-scroll').getByTestId('mobile-scroll'),
  ).toHaveAttribute('data-list-scroll', 'true');
  const detailScroll = page.locator(
    '.mobile-page:not(.route-preserved-scroll) > [data-testid="mobile-scroll"]',
  );
  await expect(detailScroll).not.toHaveAttribute('data-list-scroll');
  await expect.poll(() => detailScroll.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByRole('button', { name: '뒤로 가기' }).click();

  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeCloseTo(before, 0);
});

test('사용자가 카테고리 필터를 적용한다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  await page.getByRole('button', { name: '필터' }).click();

  await expect(page.getByRole('heading', { name: '카테고리 필터' })).toBeVisible();
  await page.getByRole('button', { name: '뷰티' }).click();
  await page.locator('.category-child-row').filter({ hasText: '스킨케어' }).click();
  await page.getByRole('button', { name: '1개 적용하기' }).click();

  await expect(page.getByRole('button', { name: '필터, 1개 선택됨' })).toBeVisible();
});

test('사용자가 상품 정렬 조건을 변경한다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();

  const popularSort = page.getByRole('radio', { name: '인기순' });
  const purchasedSort = page.getByRole('radio', { name: '구매순' });

  await expect(page.getByRole('radio', { name: 'AI 추천순' })).toHaveCount(0);
  await expect(popularSort).toHaveAttribute('aria-checked', 'true');

  await purchasedSort.click();
  await expect(purchasedSort).toHaveAttribute('aria-checked', 'true');
  await expect(popularSort).toHaveAttribute('aria-checked', 'false');
});

test('[QA 76] 상품을 먼저 선택한 뒤 친구를 선택해 선물을 완료한다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  await page.locator('.product-card').nth(2).click();
  await page.getByRole('button', { name: /선물하기/ }).click();

  const sheet = page.getByRole('dialog', { name: '받는 사람 선택' });
  await expect(sheet).toBeVisible();
  const recipient = sheet.locator('.friend-card').filter({ hasText: '김민지' }).first();
  await recipient.getByRole('button', { name: '선택' }).click();

  await expect(page.getByRole('heading', { name: '완료' })).toBeVisible();
  await expect(page.locator('.summary-card')).toContainText('김민지');
});
