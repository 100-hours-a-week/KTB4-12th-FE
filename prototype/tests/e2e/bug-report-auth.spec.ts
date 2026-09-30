import { expect, test } from '@playwright/test';

test('로그인 사용자의 제보에 JWT를 보내고 401이면 익명으로 재시도한다', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
  });

  const authorizationHeaders: Array<string | undefined> = [];
  await page.route('**/bug-report', async (route) => {
    authorizationHeaders.push(route.request().headers().authorization);
    await route.fulfill({ status: authorizationHeaders.length === 1 ? 401 : 204 });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '의견 남기기' }).click();
  await page.getByRole('textbox').fill('인증 제보 테스트');
  await page.getByRole('button', { name: '전송', exact: true }).click();

  await expect(page.getByText('소중한 의견 감사해요!')).toBeVisible();
  expect(authorizationHeaders).toEqual(['Bearer prototype-test-token', undefined]);
});
