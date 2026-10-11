import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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

test('가입 화면의 피드백 버튼은 다음 버튼을 가리지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('accessToken');
    localStorage.setItem('prototype-auth', 'signed-out');
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  const feedback = await page.getByRole('button', { name: '의견 남기기' }).boundingBox();
  const next = await page.getByRole('button', { name: '다음', exact: true }).boundingBox();
  expect(feedback).not.toBeNull();
  expect(next).not.toBeNull();
  expect(feedback!.y + feedback!.height).toBeLessThan(next!.y);
});
