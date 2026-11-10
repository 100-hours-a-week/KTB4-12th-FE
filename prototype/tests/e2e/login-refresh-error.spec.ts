import { expect, test } from '@playwright/test';

for (const expiry of ['missing', 'future']) {
  test(`동시 401과 결제를 한 번 갱신한다: ${expiry}`, async ({ page }) => {
    await page.goto('/tests/runtime-fixture.html');
    let refreshes = 0;
    let expiredRequests = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshes++;
      await expect.poll(() => expiredRequests).toBe(3);
      await route.fulfill({ json: { data: { accessToken: 'new-token', expiresIn: 3600 } } });
    });
    const payments: Array<{ key: string; body: string | null }> = [];
    await page.route('**/refresh-test/*', (route) => {
      if (route.request().method() === 'POST')
        payments.push({
          key: route.request().headers()['idempotency-key'],
          body: route.request().postData(),
        });
      if (route.request().headers().authorization === 'Bearer old-token') {
        expiredRequests++;
        return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
      }
      return route.fulfill({ json: { data: 'ok' } });
    });
    const result = await page.evaluate(async (expiry) => {
      const client = await import(/* @vite-ignore */ '/src/shared/api/client.ts');
      const session = await import(/* @vite-ignore */ '/src/shared/api/session.ts');
      session.saveSession({ accessToken: 'old-token', refreshToken: '', expiresIn: 3600 });
      if (expiry === 'missing') localStorage.removeItem('accessTokenExpiresAt');
      return Promise.all([
        client.apiGet('/refresh-test/one'),
        client.apiGet('/refresh-test/two'),
        client.apiPostWithHeaders(
          '/refresh-test/payment',
          { quantity: 1 },
          { 'Idempotency-Key': 'same-key' },
        ),
      ]);
    }, expiry);
    expect(result).toEqual(['ok', 'ok', 'ok']);
    expect(refreshes).toBe(1);
    expect(payments).toEqual([
      { key: 'same-key', body: '{"quantity":1}' },
      { key: 'same-key', body: '{"quantity":1}' },
    ]);
  });
}

for (const status of [401, 503]) {
  test(`갱신 실패 ${status}: 인증 거절만 세션을 지운다`, async ({ page }) => {
    await page.goto('/tests/runtime-fixture.html');
    await page.route('**/refresh-test/protected', (route) =>
      route.fulfill({
        status: 401,
        json: { error: { code: 'UNAUTHORIZED' } },
      }),
    );
    await page.route('**/auth/refresh', (route) => route.fulfill({ status, json: {} }));
    await page.route('**/auth/logout', (route) => route.fulfill({ status: 204 }));
    const token = await page.evaluate(async () => {
      const client = await import(/* @vite-ignore */ '/src/shared/api/client.ts');
      const session = await import(/* @vite-ignore */ '/src/shared/api/session.ts');
      session.saveSession({ accessToken: 'old-token', refreshToken: '' });
      await client.apiGet('/refresh-test/protected').catch(() => undefined);
      return localStorage.getItem('accessToken');
    });
    expect(token).toBe(status === 401 ? null : 'old-token');
  });
}

test('한 요청 취소가 공유 갱신과 다른 요청을 취소하지 않는다', async ({ page }) => {
  await page.goto('/tests/runtime-fixture.html');
  let refreshes = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/auth/refresh', async (route) => {
    refreshes++;
    await gate;
    await route.fulfill({ json: { data: { accessToken: 'new-token', expiresIn: 3600 } } });
  });
  await page.route('**/refresh-test/*', (route) =>
    route.fulfill(
      route.request().headers().authorization === 'Bearer old-token'
        ? { status: 401, json: { error: { code: 'UNAUTHORIZED' } } }
        : { json: { data: 'ok' } },
    ),
  );
  const result = page.evaluate(async () => {
    const client = await import(/* @vite-ignore */ '/src/shared/api/client.ts');
    const session = await import(/* @vite-ignore */ '/src/shared/api/session.ts');
    session.saveSession({ accessToken: 'old-token', refreshToken: '' });
    const controller = new AbortController();
    window.addEventListener('cancel-refresh-caller', () => controller.abort(), { once: true });
    return Promise.all([
      client
        .apiGet('/refresh-test/one', {}, { signal: controller.signal })
        .catch((error: Error) => error.name),
      client.apiGet('/refresh-test/two'),
    ]);
  });
  await expect.poll(() => refreshes).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('cancel-refresh-caller')));
  release();
  expect(await result).toEqual(['AbortError', 'ok']);
  expect(refreshes).toBe(1);
});
