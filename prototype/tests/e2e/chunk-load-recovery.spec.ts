import { expect, test } from '@playwright/test';

test('로그인 화면 파일 로딩 실패를 안내하고 새로고침으로 복구한다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('prototype-auth', 'signed-out');
    localStorage.removeItem('accessToken');
  });
  await page.route('**/src/pages/login/index.ts*', (route) => route.abort(), { times: 1 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '화면 파일을 불러오지 못했어요' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('저장하지 않은 입력은 사라질 수 있어요.');
  await expect(page.locator('.global-error-screen pre')).toHaveCount(0);
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible();
});
