import { expect, test } from '@playwright/test';

for (const width of [320, 375, 1100]) {
  test(`${width}px에서 긴 친구 이메일이 목록과 선물하기 버튼을 밀지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'prototype-test-token');
    });
    await page.goto('/');
    const cards = page.locator('.friend-card');
    await expect(cards.first()).toBeVisible();
    await cards
      .first()
      .locator('.friend-identity > span')
      .evaluate((element) => {
        element.textContent = 'very.long.email.address.for.mobile.layout@example.com';
      });
    for (const card of [cards.first(), cards.nth(1)]) {
      const geometry = await card.evaluate((element) => {
        const button = element.querySelector('.pill-button')!;
        const email = element.querySelector('.friend-identity > span')!;
        const menu = element.querySelector('.friend-more-trigger')!;
        const cardRect = element.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(button);
        return {
          lines: range.getClientRects().length,
          cardRight: cardRect.right,
          buttonRight: buttonRect.right,
          menuRight: menu.getBoundingClientRect().right,
          emailRight: email.getBoundingClientRect().right,
          buttonLeft: buttonRect.left,
          viewport: innerWidth,
        };
      });
      expect(geometry.lines).toBe(1);
      expect(geometry.cardRight).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.buttonRight).toBeLessThanOrEqual(geometry.cardRight);
      expect(geometry.menuRight).toBeLessThanOrEqual(geometry.cardRight);
      expect(geometry.emailRight).toBeLessThanOrEqual(geometry.buttonLeft);
    }
    await page.screenshot({ path: `/tmp/friend-card-fixed-${width}.png` });
    await cards.first().getByRole('button', { name: '선물하기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '선물 탐색', exact: true })).toBeVisible();
  });
}
