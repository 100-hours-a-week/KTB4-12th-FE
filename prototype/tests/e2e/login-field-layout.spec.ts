import { expect, test } from '@playwright/test';
for (const width of [320, 375, 1100]) {
  test(`${width}px 로그인 입력창 너비가 동일하다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem('prototype-auth', 'signed-out');
      localStorage.removeItem('accessToken');
    });
    await page.goto('/');
    const email = page.getByLabel('이메일');
    await expect(email).toBeVisible();
    const emailBox = (await email.boundingBox())!;
    const passwordBox = (await page.locator('.login-page .input-with-icon').boundingBox())!;
    const inputBox = (await page.getByLabel('비밀번호', { exact: true }).boundingBox())!;
    expect(Math.abs(inputBox.width - emailBox.width)).toBeLessThanOrEqual(2.1);
    expect(passwordBox.width).toBeCloseTo(emailBox.width, 0);
    expect(passwordBox.x).toBeCloseTo(emailBox.x, 0);
    await page.screenshot({ path: `/tmp/login-fields-${width}.png` });
  });
}
