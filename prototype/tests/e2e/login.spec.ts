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
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
});

test('이메일 또는 비밀번호가 비어 있으면 로그인 버튼을 비활성화한다', async ({ page }) => {
  await page.getByLabel('이메일').fill('wrong@gift.local');

  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
});

for (const width of [390, 1100]) {
  test(`${width}px 로그인 비밀번호를 표시·숨김해도 값이 유지되고 토글은 제출하지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const password = page.getByLabel('비밀번호', { exact: true });
    await page.getByLabel('이메일').fill('test@gift.local');
    await password.fill('Test1234!');
    await expect(password).toHaveAttribute('type', 'password');
    const show = page.getByRole('button', { name: '비밀번호 보기', exact: true });
    await expect(show).toHaveAttribute('type', 'button');
    await show.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(password).toHaveValue('Test1234!');
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
    await page.getByRole('button', { name: '비밀번호 숨기기', exact: true }).press('Enter');
    await expect(password).toHaveAttribute('type', 'password');
    await expect(password).toHaveValue('Test1234!');
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
    await password.press('Enter');
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
  });
}
