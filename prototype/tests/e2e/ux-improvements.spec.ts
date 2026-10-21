import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.setItem('accessToken', 'design-test-token');
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() + 3_600_000));
  });
});

test('확인 모달은 포커스를 순환하고 취소 후 화면 위치와 포커스를 복원한다', async ({ page }) => {
  await page.goto('/');
  const remove = page.getByRole('button', { name: '김민지 친구 메뉴' });
  await remove.click();
  await page.getByRole('menuitem', { name: '김민지 친구 삭제' }).click();
  const dialog = page.getByRole('dialog', { name: '친구 삭제' });
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole('button', { name: '돌아가기' });
  const confirm = dialog.getByRole('button', { name: '삭제' });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(remove).toBeFocused();
  expect(await page.getByTestId('device-screen').evaluate((element) => element.scrollTop)).toBe(0);
});

for (const width of [320, 360]) {
  test(`${width}px에서 주요 화면은 가로 넘침 없이 모든 메뉴를 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/?qa=friend-requests');
    for (const [tab, heading] of [
      ['친구', '친구'],
      ['선물', '선물 탐색'],
      ['마이', '마이페이지'],
    ]) {
      await page
        .getByRole('navigation', { name: '하단 메뉴' })
        .getByRole('button', { name: tab, exact: true })
        .click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await expect(
        page.getByRole('navigation', { name: '하단 메뉴' }).getByRole('button'),
      ).toHaveCount(3);
    }
  });
}

test('아래쪽 설정으로 이동해도 바깥 기기 프레임은 스크롤되지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
  await page.getByRole('button', { name: /내 선물 취향/ }).click();
  await expect(page.getByRole('heading', { name: '내 선물 취향' })).toBeVisible();
  expect(await page.getByTestId('device-screen').evaluate((element) => element.scrollTop)).toBe(0);
});

for (const width of [360, 1100]) {
  test(`${width}px 로그인·가입 리포트 버튼은 일반 화면 플로팅 버튼과 같은 위치에 표시된다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const floating = await page
      .getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' })
      .boundingBox();
    expect(floating).not.toBeNull();
    await page.addInitScript(() => {
      if (window.top !== window) return;
      localStorage.removeItem('accessToken');
      localStorage.setItem('prototype-auth', 'signed-out');
    });
    await page.goto('/');
    const report = page.getByRole('button', { name: '의견 남기기', exact: true });
    const expectSamePosition = async () => {
      await expect(report).toBeVisible();
      const box = await report.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box!.x - floating!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.y - floating!.y)).toBeLessThanOrEqual(1);
    };
    await expectSamePosition();
    await page.getByRole('button', { name: '회원가입' }).click();
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'signup');
    await expect(page.getByRole('button', { name: '다음', exact: true })).toBeVisible();
    await expectSamePosition();
    await report.click();
    await expect(page.getByRole('dialog', { name: '의견 남기기' })).toBeVisible();
  });
}
