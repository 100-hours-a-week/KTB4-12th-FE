import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-out');
    window.localStorage.removeItem('accessToken');
  });
  await page.goto('/');
});

test('기존 사용자가 올바른 계정으로 로그인하면 친구 화면으로 이동한다', async ({ page }) => {
  await page.getByLabel('이메일').fill('test@gift.local');
  await page.getByLabel('비밀번호').fill('Test1234!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
});

test('이메일 또는 비밀번호가 비어 있으면 오류를 표시하고 로그인 화면을 유지한다', async ({
  page,
}) => {
  await page.getByLabel('이메일').fill('wrong@gift.local');
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText('이메일 또는 비밀번호가 일치하지 않습니다.');
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
});
