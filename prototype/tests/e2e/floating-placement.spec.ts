import { expect, test } from '@playwright/test';

for (const width of [320, 390, 1100]) {
  test(`${width}px 상품 보조 버튼은 공간 예약 없이 고정되고 채팅 입력과 분리되며 시트 뒤에서 숨는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('authUser', JSON.stringify({ userId: 1, name: '홍길동' }));
    });
    await page.goto('/?chatMock=text');
    await page.getByRole('navigation').getByRole('button', { name: '선물', exact: true }).click();
    const toggle = page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' });
    await page.getByRole('button', { name: '필터', exact: true }).click();
    await expect(toggle).toBeHidden();
    await page.getByRole('button', { name: '카테고리 필터 닫기' }).click();
    await expect(toggle).toBeVisible();
    await page.locator('.product-card').first().click();
    await expect(page.getByRole('heading', { name: '상품 상세' })).toBeVisible();
    await expect(toggle).toBeInViewport();
    const initialMenu = await toggle.boundingBox();
    const productScroll = page.locator(
      '.app-screen:not(.route-preserved-scroll) [data-testid="mobile-scroll"]',
    );
    await productScroll.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(toggle).toBeInViewport();
    const menu = await toggle.boundingBox();
    expect(Math.abs(menu!.y - initialMenu!.y)).toBeLessThanOrEqual(1);
    const viewport = await page.locator('.app-screen:not(.route-preserved-scroll)').boundingBox();
    expect(viewport!.y + viewport!.height).toBeGreaterThan(menu!.y + menu!.height);
    const dock = await page.locator('.product-feedback-dock').boundingBox();
    expect(dock!.width).toBe(menu!.width);
    await toggle.click();
    await page.getByRole('button', { name: '의견 남기기', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '의견 남기기' })).toBeVisible();
    await page.keyboard.press('Escape');
    await toggle.click();
    await page.getByRole('button', { name: '선잘알 봇 열기' }).click();
    await page.getByRole('button', { name: '받는 사람 선택', exact: true }).click();
    await page
      .getByRole('dialog', { name: '받는 사람 선택' })
      .getByRole('button', { name: '선택', exact: true })
      .first()
      .click();
    const report = page.getByRole('button', { name: '의견 남기기', exact: true });
    await expect(report).toBeVisible();
    const reportBox = await report.boundingBox();
    const composer = await page.locator('.ai-composer').boundingBox();
    expect(reportBox!.y + reportBox!.height).toBeLessThanOrEqual(composer!.y);
    await report.click();
    await expect(page.getByRole('dialog', { name: '의견 남기기' })).toBeVisible();
  });
}
