import { expect, type Page, type Route, test } from '@playwright/test';

const userA = { userId: 1, name: '계정 A', email: 'account-a@example.com' };
const userB = { userId: 2, name: '계정 B', email: 'account-b@example.com' };
const profile = (user: typeof userA) => ({
  ...user,
  birth: '2000-01-01',
  isBirthdayPublic: false,
  giftSummary: { sentCount: 0, receivedCount: 0, period: { from: '2026-01-01', to: '2026-12-31' } },
});

async function setup(page: Page, bProfileFails = false) {
  const state = { holdA: false, heldA: 0, profileCalls: 0 };
  let releaseA!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseA = resolve;
  });
  await page.addInitScript((user) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (!String(input).endsWith('/notifications/events')) return originalFetch(input, init);
      return new Response(
        new ReadableStream({
          start(controller) {
            Object.assign(window, { endNotificationStream: () => controller.close() });
            init?.signal?.addEventListener('abort', () => {
              try {
                controller.close();
              } catch {
                /* Stream may already be closed. */
              }
            });
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('accessToken', 'token-a');
    localStorage.setItem('refreshToken', 'refresh-a');
    localStorage.setItem('authUser', JSON.stringify(user));
    localStorage.setItem('prototype-auth', 'signed-in');
  }, userA);
  await page.route('**/users/me', async (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ json: { data: {} } });
    state.profileCalls++;
    const isA = route.request().headers().authorization === 'Bearer token-a';
    if (isA && state.holdA) {
      state.heldA++;
      await gate;
    }
    if (!isA && bProfileFails)
      return route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_SERVER_ERROR' } } });
    return route.fulfill({ json: { data: profile(isA ? userA : userB) } });
  });
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ json: { data: { unreadCount: 0 } } }),
  );
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: { data: { friends: [], pagination: { nextCursor: null, hasNext: false } } },
    }),
  );
  await page.route('**/auth/logout', (route) => route.fulfill({ json: { data: {} } }));
  await page.route('**/auth/login', (route) =>
    route.fulfill({
      json: {
        data: {
          accessToken: 'token-b',
          refreshToken: 'refresh-b',
          expiresIn: 3600,
          user: userB,
          isFirstLogin: false,
        },
      },
    }),
  );
  await page.route('**/users/search?**', (route) =>
    route.fulfill({ json: { data: { user: userA } } }),
  );
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
  await expect(page.locator('.profile-card')).toContainText(userA.name);
  return { state, releaseA };
}

async function logout(page: Page) {
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page
    .getByRole('dialog', { name: '로그아웃하시겠어요?' })
    .getByRole('button', { name: '로그아웃', exact: true })
    .click();
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
}
async function changeBirthdayVisibility(page: Page) {
  await page.getByRole('switch', { name: '생일 공개' }).click();
  await page.getByRole('button', { name: '동의하고 공개' }).click();
}

async function reconnectNotifications(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { endNotificationStream: () => void }).endNotificationStream(),
  );
}

test('화면 이동은 프로필을 재조회하지 않고 저장과 새 로그인은 재조회한다', async ({ page }) => {
  const { state, releaseA } = await setup(page);
  releaseA();
  const initialCalls = state.profileCalls;
  for (const tab of ['친구', '마이']) {
    await page.getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
  }
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await expect(page.getByRole('switch', { name: '생일 공개' })).toBeVisible();
  expect(state.profileCalls).toBe(initialCalls);
  await changeBirthdayVisibility(page);
  await expect.poll(() => state.profileCalls).toBe(initialCalls + 1);
  await logout(page);
  await loginB(page);
  await expect.poll(() => state.profileCalls).toBe(initialCalls + 2);
});
async function loginB(page: Page) {
  await page.getByLabel('이메일').fill(userB.email);
  await page.getByLabel('비밀번호').fill('Password123!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '친구', exact: true })).toBeVisible();
}
async function searchA(page: Page) {
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await page.getByRole('textbox', { name: '친구 이메일 검색' }).fill(userA.email);
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByRole('button', { name: '계정 A 추가', exact: true })).toBeVisible();
}

for (const storedRefreshToken of [false, true]) {
  test(`로그아웃은 HttpOnly 쿠키를 전송하고 만료시킨다 (저장 토큰: ${storedRefreshToken})`, async ({
    page,
    context,
    baseURL,
  }) => {
    const { releaseA } = await setup(page);
    releaseA();
    if (!storedRefreshToken) await page.evaluate(() => localStorage.removeItem('refreshToken'));
    await context.addCookies([
      {
        name: 'refreshToken',
        value: 'cookie-refresh-a',
        domain: new URL(baseURL!).hostname,
        path: '/auth',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    let logoutCalls = 0;
    await page.route('**/auth/logout', async (route) => {
      logoutCalls += 1;
      expect(route.request().method()).toBe('POST');
      expect(route.request().postDataJSON()).toEqual(
        storedRefreshToken ? { refreshToken: 'refresh-a' } : {},
      );
      expect((await route.request().allHeaders()).cookie).toContain(
        'refreshToken=cookie-refresh-a',
      );
      await route.fulfill({
        headers: { 'Set-Cookie': 'refreshToken=; Path=/auth; Max-Age=0; HttpOnly; SameSite=Lax' },
        json: { data: {} },
      });
    });
    await page.getByRole('button', { name: '내 정보 관리' }).click();
    await logout(page);
    expect(logoutCalls).toBe(1);
    expect((await context.cookies()).filter((cookie) => cookie.name === 'refreshToken')).toEqual(
      [],
    );
    expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
  });
}

test('B 프로필 조회가 실패해도 A를 본인으로 오인하지 않는다', async ({ page }) => {
  const { releaseA } = await setup(page, true);
  releaseA();
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await logout(page);
  await loginB(page);
  await searchA(page);
  await page.getByRole('button', { name: '친구 추가 닫기' }).click();
  await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
  await expect(page.locator('.profile-card')).not.toContainText(userA.name);
});

test('계정 전환 뒤 도착한 A 프로필 응답이 B 프로필을 덮어쓰지 않는다', async ({ page }) => {
  const { state, releaseA } = await setup(page);
  state.holdA = true;
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await changeBirthdayVisibility(page);
  await expect.poll(() => state.heldA).toBeGreaterThan(0);
  await logout(page);
  await loginB(page);
  await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
  await expect(page.locator('.profile-card')).toContainText(userB.name);
  const oldResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/users/me') &&
      response.request().headers().authorization === 'Bearer token-a',
  );
  releaseA();
  await (await oldResponse).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator('.profile-card')).toContainText(userB.name);
  await expect(page.locator('.profile-card')).not.toContainText(userA.name);
});

test('세션 만료 후 B로 로그인해도 이전 프로필이 남지 않는다', async ({ page }) => {
  const { releaseA } = await setup(page, true);
  releaseA();
  const unauthorized = (route: Route) =>
    route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
  await page.route('**/notifications/unread-count', unauthorized);
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await reconnectNotifications(page);
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  await page.unroute('**/notifications/unread-count', unauthorized);
  await loginB(page);
  await searchA(page);
  await page.getByRole('button', { name: '친구 추가 닫기' }).click();
  await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
  await expect(page.locator('.profile-card')).not.toContainText(userA.name);
});

test('세션 만료 시 친구 추가 시트를 닫는다', async ({ page }) => {
  const { releaseA } = await setup(page);
  releaseA();
  await page.getByRole('navigation').getByRole('button', { name: '친구', exact: true }).click();
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.route('**/users/search?**', (route) =>
    route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }),
  );
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await page.getByRole('textbox', { name: '친구 이메일 검색' }).fill(userA.email);
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
  await expect(page.getByRole('button', { name: '친구 추가 닫기' })).not.toBeVisible();
});

test('B 알림 조회 실패 시 A의 알림 숫자를 초기화한다', async ({ page }) => {
  const { releaseA } = await setup(page);
  releaseA();
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ json: { data: { unreadCount: 9 } } }),
  );
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await reconnectNotifications(page);
  await expect(page.locator('.notification-button span')).toHaveText('9');
  await logout(page);
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_SERVER_ERROR' } } }),
  );
  await loginB(page);
  await expect(page.getByRole('button', { name: '알림 0개, 알림 목록 열기' })).toBeVisible();
});

test('이전 계정의 늦은 401은 B 세션을 종료하지 않는다', async ({ page }) => {
  const { releaseA } = await setup(page);
  releaseA();
  let held = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/users/me', async (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ json: { data: {} } });
    if (route.request().headers().authorization === 'Bearer token-a') {
      held = true;
      await gate;
      await route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    } else await route.fulfill({ json: { data: profile(userB) } });
  });
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await changeBirthdayVisibility(page);
  await expect.poll(() => held).toBe(true);
  await logout(page);
  await loginB(page);
  const response = page.waitForResponse((r) => r.url().endsWith('/users/me') && r.status() === 401);
  release();
  await (await response).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe('token-b');
});

test('AI 입력 초안을 다음 계정에 남기지 않는다', async ({ page }) => {
  const { releaseA } = await setup(page);
  releaseA();
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          friends: [
            { friendId: 31, userId: 27, name: '수신자', email: 'friend@example.com', birth: null },
          ],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
  const openAi = async () => {
    await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
    await page.getByRole('button', { name: '선잘알 봇 열기' }).click();
    await page.getByRole('button', { name: '받는 사람 선택', exact: true }).click();
    await page
      .getByRole('dialog', { name: '받는 사람 선택', exact: true })
      .getByRole('button', { name: '선택', exact: true })
      .click();
  };
  await openAi();
  await page.getByPlaceholder('메시지를 입력하세요...').fill('계정 A의 선물 고민');
  await page.getByRole('button', { name: '뒤로 가기', exact: true }).click();
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await logout(page);
  await loginB(page);
  await openAi();
  await expect(page.getByPlaceholder('메시지를 입력하세요...')).toHaveValue('');
});

test('계정 전환 후 늦게 도착한 알림 숫자는 무시한다', async ({ page }) => {
  const { releaseA } = await setup(page);
  releaseA();
  let held = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/notifications/unread-count', async (route) => {
    const isA = route.request().headers().authorization === 'Bearer token-a';
    if (isA) {
      held = true;
      await gate;
    }
    await route.fulfill({ json: { data: { unreadCount: isA ? 9 : 2 } } });
  });
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await reconnectNotifications(page);
  await expect.poll(() => held).toBe(true);
  await logout(page);
  await loginB(page);
  await expect(page.getByRole('button', { name: '알림 2개, 알림 목록 열기' })).toBeVisible();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith('/notifications/unread-count') &&
      r.request().headers().authorization === 'Bearer token-a',
  );
  release();
  await (await response).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByRole('button', { name: '알림 2개, 알림 목록 열기' })).toBeVisible();
});

test('이전 계정의 토큰 갱신 응답은 새 계정 토큰을 덮어쓰지 않는다', async ({ page }) => {
  const { releaseA } = await setup(page);
  releaseA();
  await page.evaluate(() =>
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() - 1000)),
  );
  let held = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/users/me', (route) =>
    route.request().headers().authorization === 'Bearer token-a'
      ? route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } })
      : route.fulfill({ json: { data: profile(userB) } }),
  );
  await page.route('**/auth/refresh', async (route) => {
    held = true;
    await gate;
    await route.fulfill({
      json: {
        data: { accessToken: 'refreshed-a', refreshToken: 'refreshed-refresh-a', expiresIn: 3600 },
      },
    });
  });
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await changeBirthdayVisibility(page);
  await expect.poll(() => held).toBe(true);
  await logout(page);
  await loginB(page);
  const response = page.waitForResponse('**/auth/refresh');
  release();
  await (await response).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe('token-b');
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('refresh-b');
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
});

test('현재 계정의 만료된 토큰은 갱신하고 원래 요청을 재시도한다', async ({ page }) => {
  const { releaseA } = await setup(page);
  releaseA();
  await page.evaluate(() =>
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() - 1000)),
  );
  await page.route('**/users/me', (route) =>
    route.request().headers().authorization === 'Bearer token-a'
      ? route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } })
      : route.fulfill({ json: { data: profile({ ...userA, name: '갱신된 계정 A' }) } }),
  );
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({ json: { data: { accessToken: 'refreshed-a', expiresIn: 3600 } } }),
  );
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'account');
  await changeBirthdayVisibility(page);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('accessToken')))
    .toBe('refreshed-a');
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await expect(page.locator('.profile-card')).toContainText('갱신된 계정 A');
});

for (const relogin of [false, true]) {
  test(`다른 탭의 같은 계정 토큰 갱신은 화면과 미저장 취향을 유지한다 (재로그인: ${relogin})`, async ({
    page,
    context,
  }) => {
    const { releaseA } = await setup(page);
    releaseA();
    if (relogin) {
      await page.getByRole('button', { name: '내 정보 관리' }).click();
      await logout(page);
      await loginB(page);
      await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
    }
    await page.route('**/preferences', (route) =>
      route.fulfill({ json: { data: { preference: '기존 취향' } } }),
    );
    await page.getByRole('button', { name: /내 선물 취향/ }).click();
    const field = page.getByRole('textbox');
    await expect(field).toHaveValue('기존 취향');
    await field.fill('아직 저장하지 않은 취향');
    await page.evaluate(`
      window.tokenStorageEvents = 0;
      window.addEventListener('storage', (event) => {
        if (event.key === 'accessToken') window.tokenStorageEvents++;
      });
    `);
    const other = await context.newPage();
    await other.goto('/tests/runtime-fixture.html');
    await other.evaluate(() => {
      localStorage.setItem('accessToken', 'refreshed-token');
      localStorage.setItem('refreshToken', 'refreshed-refresh-token');
      localStorage.setItem('accessTokenExpiresAt', String(Date.now() + 3600_000));
    });
    await page.waitForFunction('window.tokenStorageEvents > 0');
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'gift-preference');
    await expect(field).toHaveValue('아직 저장하지 않은 취향');
    await expect(page.getByRole('button', { name: '저장하기' })).toBeEnabled();
  });
}

for (const change of ['account', 'logout', 'remove-token'] as const) {
  test(`다른 탭의 ${change} 변경은 이전 계정 화면과 초안을 초기화한다`, async ({
    page,
    context,
  }) => {
    const { releaseA } = await setup(page);
    releaseA();
    await page.route('**/preferences', (route) =>
      route.fulfill({ json: { data: { preference: '기존 취향' } } }),
    );
    await page.getByRole('button', { name: /내 선물 취향/ }).click();
    await expect(page.getByRole('textbox')).toHaveValue('기존 취향');
    await page.getByRole('textbox').fill('이전 계정의 미저장 취향');
    const other = await context.newPage();
    await other.goto('/tests/runtime-fixture.html');
    await other.evaluate(
      ({ change, userB }) => {
        if (change === 'account') {
          localStorage.setItem('accessToken', 'token-b');
          localStorage.setItem('authUser', JSON.stringify(userB));
        } else if (change === 'logout') {
          localStorage.clear();
          localStorage.setItem('prototype-auth', 'signed-out');
        } else localStorage.removeItem('accessToken');
      },
      { change, userB },
    );
    await expect(page.getByTestId('gift-app')).toHaveAttribute(
      'data-route',
      change === 'account' ? 'friends' : 'login',
    );
    await expect(
      page.getByPlaceholder('좋아하는 스타일, 색상, 필요한 물건을 자유롭게 적어주세요.'),
    ).toHaveCount(0);
    if (change === 'account') {
      await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
      await expect(page.locator('.profile-card')).toContainText(userB.name);
      await expect(page.locator('.profile-card')).not.toContainText(userA.name);
    }
  });
}

test('다른 탭의 토큰 갱신 전 요청의 늦은 401은 새 토큰으로 재시도한다', async ({
  page,
  context,
}) => {
  const { releaseA } = await setup(page);
  releaseA();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tokens: Array<string | undefined> = [];
  const authCalls: string[] = [];
  await page.route(/\/auth\/(refresh|logout)$/, (route) => {
    authCalls.push(route.request().url());
    return route.fulfill({ status: 500, json: {} });
  });
  await page.route('**/preferences', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { data: { preference: '기존 취향' } } });
    const token = route.request().headers().authorization;
    tokens.push(token);
    if (token === 'Bearer token-a') {
      await gate;
      return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    }
    expect(route.request().postDataJSON()).toEqual({ preference: '저장할 취향' });
    return route.fulfill({ json: { data: { preference: '저장할 취향' } } });
  });
  await page.getByRole('button', { name: /내 선물 취향/ }).click();
  await expect(page.getByRole('textbox')).toHaveValue('기존 취향');
  await page.getByRole('textbox').fill('저장할 취향');
  const oldRequest = page.waitForRequest(
    (request) => request.url().endsWith('/preferences') && request.method() === 'PUT',
  );
  await page.getByRole('button', { name: '저장하기' }).click();
  await oldRequest;
  await page.evaluate(`
    window.tokenStorageEvents = 0;
    window.addEventListener('storage', (event) => {
      if (event.key === 'accessToken') window.tokenStorageEvents++;
    });
  `);
  const other = await context.newPage();
  await other.goto('/tests/runtime-fixture.html');
  await other.evaluate(() => localStorage.setItem('accessToken', 'refreshed-a'));
  await page.waitForFunction('window.tokenStorageEvents > 0');
  release();
  await expect(page.getByRole('status')).toHaveText('저장되었습니다.');
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'gift-preference');
  await expect(page.getByRole('textbox')).toHaveValue('저장할 취향');
  expect(tokens).toEqual(['Bearer token-a', 'Bearer refreshed-a']);
  expect(authCalls).toEqual([]);
});
