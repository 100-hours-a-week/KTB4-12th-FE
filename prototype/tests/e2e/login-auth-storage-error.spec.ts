import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('prototype-auth', 'signed-out');
  });
});

test('인증 제한 저장소 장애 시 내부 정보 없이 503 안내를 표시한다', async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '인증 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
        error: {
          code: 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE',
          traceId: '01JXYZ8D7G5K2M4N6P8Q',
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByLabel('이메일').fill('test@gift.local');
  await page.getByLabel('비밀번호').fill('Test1234!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText(
    '인증 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  );
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeEnabled();
  await expect(page.getByText('AUTHENTICATION_TEMPORARILY_UNAVAILABLE')).toHaveCount(0);
  await expect(page.getByText('01JXYZ8D7G5K2M4N6P8Q')).toHaveCount(0);
  await expect(page.getByText('DataAccessException')).toHaveCount(0);

  const storedSession = await page.evaluate(() => ({
    accessToken: window.localStorage.getItem('accessToken'),
    refreshToken: window.localStorage.getItem('refreshToken'),
    expiresAt: window.localStorage.getItem('accessTokenExpiresAt'),
    authUser: window.localStorage.getItem('authUser'),
    authState: window.localStorage.getItem('prototype-auth'),
  }));
  expect(storedSession).toEqual({
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    authUser: null,
    authState: 'signed-out',
  });
});
