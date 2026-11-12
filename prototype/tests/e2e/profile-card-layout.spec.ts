import { expect, test } from '@playwright/test';

for (const width of [320, 375, 1100]) {
  test(`${width}px에서 프로필 중복 버튼 없이 긴 이메일을 표시하고 하단 설정으로 이동한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'prototype-test-token');
      localStorage.setItem(
        'mock-profile',
        JSON.stringify({ email: 'very.long.email.address.for.mobile.layout@example.com' }),
      );
    });
    await page.goto('/');
    await page
      .getByRole('navigation', { name: '하단 메뉴' })
      .getByRole('button', { name: '마이' })
      .click();
    const card = page.locator('.profile-card');
    await expect(card.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '내 정보 관리', exact: true })).toHaveCount(0);
    await expect(card.locator('small')).toHaveText(
      'very.long.email.address.for.mobile.layout@example.com',
    );
    await expect(card.locator('.profile-credit')).toContainText('보유 크레딧');
    const geometry = await card.evaluate((element) => {
      const email = element.querySelector('small')!;
      const cardRect = element.getBoundingClientRect();
      const emailRect = email.getBoundingClientRect();
      return {
        cardRight: cardRect.right,
        emailRight: emailRect.right,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(geometry.emailRight).toBeLessThanOrEqual(geometry.cardRight);
    expect(geometry.pageOverflow).toBe(false);
    await page.screenshot({ path: `/tmp/profile-card-${width}.png` });
    await page.getByRole('button', { name: '내 정보 및 공개 설정 설정', exact: true }).click();
    await expect(page.getByRole('heading', { name: '내 정보 및 공개 설정' })).toBeVisible();
  });
}
