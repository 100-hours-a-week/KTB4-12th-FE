import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'preference-test-token');
    localStorage.setItem('gift-prototype-main-tab', 'mypage');
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 1,
          name: '테스트',
          email: 'me@example.com',
          birth: '2000-01-01',
          isBirthdayPublic: false,
          isFirstLogin: false,
          giftSummary: { sentCount: 0, receivedCount: 0 },
        },
      },
    }),
  );
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ json: { data: { unreadCount: 0 } } }),
  );
});

test('내 취향 조회 재시도, 저장 실패 복구, 300자 저장과 초기화', async ({ page }) => {
  let preference: string | null = '기존 취향';
  let failLoad = true;
  let failSave = true;
  const bodies: unknown[] = [];
  await page.route('**/preferences', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer preference-test-token');
    const saving = route.request().method() === 'PUT';
    if (saving) bodies.push(route.request().postDataJSON());
    if (saving ? failSave : failLoad) {
      if (saving) failSave = false;
      await route.fulfill({
        status: 500,
        json: {
          message: '다시 시도해 주세요.',
          error: { code: 'INTERNAL_SERVER_ERROR' },
        },
      });
      return;
    }
    if (saving) preference = route.request().postDataJSON().preference;
    await route.fulfill({ json: { data: { preference } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /내 선물 취향/ }).click();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  failLoad = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  const field = page.getByRole('textbox');
  await expect(field).toHaveValue('기존 취향');
  const value = '🎁'.repeat(300);
  await field.fill(value + '초과');
  await expect(field).toHaveValue(value);
  await expect(page.getByText('300/300', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '저장하기' }).click();
  await expect(page.getByText('다시 시도해 주세요.', { exact: true })).toBeVisible();
  await expect(field).toHaveValue(value);
  await page.getByRole('button', { name: '저장하기' }).click();
  await expect(page.getByRole('button', { name: '저장하기' })).toBeDisabled();
  await field.fill('');
  await page.getByRole('button', { name: '저장하기' }).click();
  await expect(page.getByRole('button', { name: '저장하기' })).toBeDisabled();
  expect(bodies).toEqual([{ preference: value }, { preference: value }, { preference: null }]);
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await page.getByRole('button', { name: /내 선물 취향/ }).click();
  await expect(field).toHaveValue('');
});

for (const status of [200, 500]) {
  test(`저장 중에는 편집을 막고 ${status} 응답 후 내용을 유지하며 다시 편집할 수 있다`, async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const bodies: unknown[] = [];
    await page.route('**/preferences', async (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({ json: { data: { preference: '기존 취향' } } });
      const body = route.request().postDataJSON();
      bodies.push(body);
      if (bodies.length === 1) {
        await gate;
        if (status === 500)
          return route.fulfill({
            status,
            json: { message: '다시 시도해 주세요.', error: { code: 'INTERNAL_SERVER_ERROR' } },
          });
      }
      return route.fulfill({ json: { data: { preference: body.preference } } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: /내 선물 취향/ }).click();
    const field = page.getByRole('textbox');
    await expect(field).toHaveValue('기존 취향');
    const value = '  저장할 취향 🎁  ';
    await field.fill(value);
    const saving = page.waitForRequest(
      (request) => request.url().endsWith('/preferences') && request.method() === 'PUT',
    );
    await page.getByRole('button', { name: '저장하기' }).click();
    await saving;
    await expect(field).toBeDisabled();
    await expect(field).toHaveValue(value);
    await expect(page.getByRole('button', { name: '저장 중', exact: true })).toBeDisabled();
    release();
    await expect(field).toBeEnabled();
    await expect(field).toHaveValue(status === 500 ? value : value.trim());
    if (status === 500) {
      await expect(page.getByText('다시 시도해 주세요.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '저장하기' })).toBeEnabled();
    } else {
      await expect(page.getByRole('button', { name: '저장하기' })).toBeDisabled();
    }
    await field.fill('새로 편집한 취향');
    await page.getByRole('button', { name: '저장하기' }).click();
    await expect(page.getByRole('button', { name: '저장하기' })).toBeDisabled();
    await expect(field).toBeEnabled();
    await expect(field).toHaveValue('새로 편집한 취향');
    expect(bodies).toEqual([{ preference: value.trim() }, { preference: '새로 편집한 취향' }]);
  });
}
