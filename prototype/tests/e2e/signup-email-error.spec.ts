import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-out');
    window.localStorage.removeItem('accessToken');
  });
});

test('이메일 중복 확인 중 서버 오류가 발생하면 완료 상태로 바뀌지 않는다', async ({ page }) => {
  await page.route('**/auth/email-availability', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          traceId: '01JXYZ8D7G5K2M4N6P8Q',
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이메일').fill('server-error@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
  );
  await expect(page.getByRole('button', { name: '중복확인' })).toBeEnabled();
  await expect(page.getByText('사용할 수 있는 이메일입니다.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
});

for (const status of [200, 401]) {
  test(`남은 토큰 없이 이메일 중복 확인하고 ${status} 응답에도 가입 화면을 유지한다`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'expired-token');
      localStorage.setItem('accessTokenExpiresAt', '1');
    });
    const authRequests: string[] = [];
    let authorization: string | undefined;
    await page.route(/\/auth\/(email-availability|refresh|logout)(\?|$)/, async (route) => {
      authRequests.push(new URL(route.request().url()).pathname);
      authorization = route.request().headers().authorization;
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(
          status === 200
            ? { data: { available: true } }
            : { message: '인증 오류', error: { code: 'UNAUTHORIZED' } },
        ),
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '회원가입' }).click();
    await page.getByLabel('이메일').fill('public-api@gift.local');
    await page.getByRole('button', { name: '중복확인' }).click();
    if (status === 200) {
      await expect(page.getByRole('button', { name: '확인 완료' })).toBeVisible();
    } else {
      await expect(page.getByRole('alert')).toHaveText('인증 오류');
    }
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'signup');
    expect(authorization).toBeUndefined();
    expect(authRequests).toEqual(['/auth/email-availability']);
  });
}
