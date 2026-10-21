import { expect, test } from '@playwright/test';

const profile = {
  userId: 1,
  name: '복구된 사용자',
  email: 'recovery@example.com',
  birth: '2000-01-01',
  isBirthdayPublic: false,
  creditBalance: 1000,
  giftSummary: { sentCount: 2, receivedCount: 3 },
};

for (const screen of ['mypage', 'ai-chat']) {
  test(`${screen}: 프로필 연결 실패 후 화면에서 재시도해 복구한다`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'recovery-test-token');
      localStorage.setItem('prototype-auth', 'signed-in');
      // Legacy sessions may have a token without the cached user identity.
      localStorage.removeItem('authUser');
    });
    let fail = true;
    let calls = 0;
    await page.route('**/users/me', (route) => {
      calls++;
      return fail ? route.abort('failed') : route.fulfill({ json: { data: profile } });
    });
    await page.route('**/notifications/**', (route) =>
      route.fulfill({ json: { data: { unreadCount: 0 } } }),
    );
    await page.route(/\/friends(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: { data: { friends: [], pagination: { nextCursor: null, hasNext: false } } },
      }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    if (screen === 'mypage') {
      await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
      await page.getByRole('button', { name: '선잘알 봇 열기' }).click();
    }
    await expect(page.getByRole('alert')).toContainText('내 정보를 불러오지 못했어요');
    await expect(page.getByText('로그인 정보를 확인하고 있어요.')).toHaveCount(0);
    await expect(page.locator('[data-state="loading"]')).toHaveCount(0);
    await page.screenshot({ path: `/tmp/sunjalal-audit/${screen}-recovery-error.png` });
    const beforeRetry = calls;
    fail = false;
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    if (screen === 'mypage') {
      await expect(page.locator('.profile-card')).toContainText(profile.name);
      await expect(page.getByRole('button', { name: '받은 선물 3건' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: '받는 사람 선택', exact: true })).toBeEnabled();
    }
    expect(calls).toBe(beforeRetry + 1);
  });
}

test('프로필 조회가 실패해도 설정으로 이동해 로그아웃할 수 있다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'recovery-test-token');
    localStorage.setItem('prototype-auth', 'signed-in');
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({ status: 500, json: { message: '프로필 조회 실패' } }),
  );
  await page.route('**/notifications/**', (route) =>
    route.fulfill({ json: { data: { unreadCount: 0 } } }),
  );
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: { data: { friends: [], pagination: { nextCursor: null, hasNext: false } } },
    }),
  );
  await page.route('**/auth/logout', (route) => route.fulfill({ json: { data: {} } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('내 정보를 불러오지 못했어요');
  await page.getByRole('button', { name: '내 정보 및 공개 설정 설정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '내 정보 및 공개 설정' })).toBeVisible();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page
    .getByRole('dialog', { name: '로그아웃하시겠어요?' })
    .getByRole('button', { name: '로그아웃', exact: true })
    .click();
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

test('연결 오류는 한국어로 바꾸고 요청 취소와 서버 오류 코드는 보존한다', async ({ page }) => {
  await page.goto('/');
  await page.route('**/network-probe', (route) => route.abort('failed'));
  await page.route('**/conflict-probe', (route) =>
    route.fulfill({
      status: 409,
      json: { message: '이미 처리된 요청입니다.', error: { code: 'CONFLICT' } },
    }),
  );
  const result = await page.evaluate(async () => {
    const modulePath = '/src/shared/api/client.ts';
    const { apiGet } = await import(modulePath);
    const inspect = async (path: string, signal?: AbortSignal) => {
      try {
        await apiGet(path, {}, { authenticated: false, signal });
        return null;
      } catch (error) {
        const e = error as Error & { code?: string; cause?: unknown };
        return { name: e.name, message: e.message, code: e.code, hasCause: !!e.cause };
      }
    };
    const controller = new AbortController();
    controller.abort();
    return {
      network: await inspect('/network-probe'),
      cancel: await inspect('/network-probe', controller.signal),
      conflict: await inspect('/conflict-probe'),
    };
  });
  expect(result.network).toMatchObject({ code: 'NETWORK_ERROR', hasCause: true });
  expect(result.network?.message).toContain('서버에 연결하지 못했어요');
  expect(result.cancel?.name).toBe('AbortError');
  expect(result.conflict).toMatchObject({ code: 'CONFLICT', message: '이미 처리된 요청입니다.' });
});
