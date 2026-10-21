import { expect, test } from '@playwright/test';

for (const width of [360, 1100]) {
  test(`${width}px에서 AI·리포트 캐릭터와 라벨을 표시하고 의견 모달을 연다`, async ({ page }) => {
    await page.addInitScript(() => {
      if (window.top !== window) return;
      localStorage.setItem('accessToken', 'report-ui-test-token');
      localStorage.setItem('prototype-auth', 'signed-in');
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
    await expect(page.getByText('AI 선물 추천', { exact: true })).toBeVisible();
    const menuReport = page.getByRole('button', { name: '의견 남기기', exact: true });
    await expect(menuReport.getByText('의견 보내기', { exact: true })).toBeVisible();
    await expect(menuReport.locator('img')).toHaveAttribute(
      'src',
      '/assets/brand/sunjalal-report.png',
    );
    await menuReport.click();
    await expect(page.getByRole('dialog', { name: '의견 남기기' })).toBeVisible();

    await page.addInitScript(() => {
      if (window.top !== window) return;
      localStorage.removeItem('accessToken');
      localStorage.setItem('prototype-auth', 'signed-out');
    });
    await page.goto('/');
    const report = page.getByRole('button', { name: '의견 남기기', exact: true });
    const expectCharacter = async () => {
      await expect(report.getByText('의견 보내기', { exact: true })).toHaveCount(0);
      await expect
        .poll(() => report.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    };
    await expectCharacter();
    await page.getByRole('button', { name: '회원가입', exact: true }).click();
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'signup');
    await expect(page.getByRole('button', { name: '다음', exact: true })).toBeVisible();
    await expectCharacter();
    await report.click();
    await expect(page.getByRole('dialog', { name: '의견 남기기' })).toBeVisible();
  });
}
