import { expect, test } from '@playwright/test';

for (const width of [320, 390, 1100]) {
  test(`${width}px 메인 화면의 정보 위계·터치 영역과 기존 이동을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'prototype-test-token');
    });
    await page.goto('/');
    const friend = page.locator('.friend-card').first();
    await expect(friend).toBeVisible();
    const friendBox = await friend.boundingBox();
    expect(friendBox!.height).toBeLessThanOrEqual(100);
    for (const name of ['선물하기', '김민지 친구 메뉴']) {
      const size = await friend.getByRole('button', { name, exact: true }).evaluate((node) => ({
        height: (node as HTMLElement).offsetHeight,
        width: (node as HTMLElement).offsetWidth,
      }));
      expect(size.height).toBeGreaterThanOrEqual(44);
      expect(size.width).toBeGreaterThanOrEqual(44);
    }
    const tabs = page.getByRole('tablist', { name: '친구 목록 종류' });
    await expect(tabs.getByRole('tab')).toHaveCount(3);
    await page
      .getByTestId('gift-app')
      .screenshot({ path: `/tmp/seonjalal-redesign/${width}-friends.png` });
    await friend.getByRole('button', { name: '선물하기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '선물 탐색', exact: true })).toBeVisible();
    await expect(page.locator('.browse-recipient-identity')).toContainText('김민지님에게 줄 선물');
    const card = page.locator('.product-card').first();
    await expect(card).toBeVisible();
    const productStyle = await card.evaluate((node) => {
      const title = node.querySelector('strong')!;
      const price = node.querySelector('small')!;
      const image = node.querySelector('.product-card-image')!.getBoundingClientRect();
      return {
        titleSize: getComputedStyle(title).fontSize,
        titleLineHeight: getComputedStyle(title).lineHeight,
        titleMinHeight: getComputedStyle(title).minHeight,
        priceSize: parseFloat(getComputedStyle(price).fontSize),
        squareDifference: Math.abs(image.width - image.height),
      };
    });
    // Preserve the existing product-name contract while emphasizing price.
    expect(productStyle.titleSize).toBe('13px');
    expect(productStyle.titleLineHeight).toBe('16.25px');
    expect(productStyle.titleMinHeight).toBe('32px');
    expect(productStyle.priceSize).toBeGreaterThan(13);
    expect(productStyle.squareDifference).toBeLessThan(1);
    await page
      .getByTestId('gift-app')
      .screenshot({ path: `/tmp/seonjalal-redesign/${width}-gifts.png` });
    await page
      .getByRole('navigation', { name: '하단 메뉴' })
      .getByRole('button', { name: '마이', exact: true })
      .click();
    await expect(page.locator('.profile-credit')).toContainText('보유 크레딧');
    for (const name of ['선물 내역', '나의 선물 취향', '계정 설정']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.locator('.settings-list .setting-row')).toHaveCount(6);
    await expect(
      page.getByRole('button', { name: '룰렛 이벤트 참여하기', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page
      .getByTestId('gift-app')
      .screenshot({ path: `/tmp/seonjalal-redesign/${width}-mypage.png` });
    await page.getByRole('button', { name: /^받은 선물 \d+건$/ }).click();
    await expect(page.getByRole('heading', { name: '받은 선물', exact: true })).toBeVisible();
  });
}

test('상품 필터 선택·초기화·검색 빈 상태와 오류 재시도를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'prototype-test-token');
  });
  await page.goto('/?qa=product-list-error');
  await expect(page.locator('.cursor-status[data-state="error"]')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.getByRole('button', { name: '필터', exact: true }).click();
  const filter = page.getByRole('dialog', { name: '카테고리 필터' });
  await filter.getByRole('button', { name: '뷰티', exact: true }).click();
  await filter.getByRole('button', { name: '스킨케어', exact: true }).click();
  await expect(filter.getByRole('status')).toHaveText('1개 카테고리 선택');
  await filter.screenshot({ path: '/tmp/seonjalal-redesign/filter.png' });
  await filter.getByRole('button', { name: '1개 적용하기', exact: true }).click();
  await expect(filter).toBeHidden();
  await expect(page.getByRole('button', { name: '필터, 1개 선택됨', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '필터, 1개 선택됨', exact: true }).click();
  await filter.getByRole('button', { name: '초기화', exact: true }).click();
  await filter.getByRole('button', { name: '전체 상품 보기', exact: true }).click();
  await page.getByRole('textbox', { name: '상품 검색', exact: true }).fill('없는상품테스트');
  await expect(page.getByText('일치하는 상품이 없어요', { exact: true })).toBeVisible();
});
