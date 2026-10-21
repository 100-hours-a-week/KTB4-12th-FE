import { expect, test } from '@playwright/test';

for (const width of [320, 375, 1100]) {
  test(`${width}px에서 긴 이메일이 내 정보 관리 버튼을 밀거나 줄바꿈하지 않는다`, async ({
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
    const button = card.getByRole('button', { name: '내 정보 관리' });
    await expect(button).toBeVisible();
    const geometry = await card.evaluate((element) => {
      const button = element.querySelector('button')!;
      const email = element.querySelector('small')!;
      const cardRect = element.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const emailRect = email.getBoundingClientRect();
      const text = [...button.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      const range = document.createRange();
      range.selectNodeContents(text!);
      return {
        textLines: range.getClientRects().length,
        buttonRight: buttonRect.right,
        cardRight: cardRect.right,
        emailRight: emailRect.right,
        buttonLeft: buttonRect.left,
        emailTruncated: email.scrollWidth > email.clientWidth,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(geometry.textLines).toBe(1);
    expect(geometry.buttonRight).toBeLessThanOrEqual(geometry.cardRight);
    expect(geometry.emailRight).toBeLessThanOrEqual(geometry.buttonLeft);
    expect(geometry.emailTruncated).toBe(true);
    expect(geometry.pageOverflow).toBe(false);
    await page.screenshot({ path: `/tmp/profile-card-${width}.png` });
    await button.click();
    await expect(page.getByRole('heading', { name: '내 정보 및 공개 설정' })).toBeVisible();
  });
}
