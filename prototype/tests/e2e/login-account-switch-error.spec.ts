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
  const state = { holdA: false, heldA: 0 };
  let releaseA!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseA = resolve;
  });
  await page.addInitScript((user) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('accessToken', 'token-a');
    localStorage.setItem('refreshToken', 'refresh-a');
    localStorage.setItem('authUser', JSON.stringify(user));
    localStorage.setItem('prototype-auth', 'signed-in');
  }, userA);
  await page.route('**/users/me', async (route) => {
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
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  await page.unroute('**/notifications/unread-count', unauthorized);
  await loginB(page);
  await searchA(page);
  await page.getByRole('button', { name: '친구 추가 닫기' }).click();
  await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
  await expect(page.locator('.profile-card')).not.toContainText(userA.name);
});
