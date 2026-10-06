import { expect, type Page, type Route, test } from '@playwright/test';

const friends = [27, 28].map((userId, index) => ({
  userId,
  friendId: 31 + index,
  name: index ? '이준호' : '김민지',
  email: `friend${index}@example.com`,
  birth: null,
}));
const products = (ids: number[]) =>
  ids.map((productId) => ({
    productId,
    brandName: '테스트 브랜드',
    productName: `상품 ${productId}`,
    price: 32000,
    thumbnailUrl: '',
  }));
const result = (
  ids: number[],
  appliedSort = 'AI_RECOMMENDED',
  nextCursor: string | null = null,
) => ({
  message: '상품 목록을 조회했습니다.',
  data: {
    products: products(ids),
    appliedSort,
    pagination: { nextCursor, hasNext: nextCursor !== null },
  },
});
const failure = (code: string) => ({
  message: '조회할 수 없습니다.',
  error: { code, traceId: 'test-trace' },
});

async function setup(page: Page, handle: (route: Route, params: URLSearchParams) => Promise<void>) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'prototype-test-token');
    localStorage.setItem('gift-prototype-main-tab', 'gifts');
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 1,
          name: '테스트',
          email: 'me@example.com',
          birth: null,
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
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: { data: { friends, pagination: { nextCursor: null, hasNext: false } } },
    }),
  );
  await page.route('**/products/categories', (route) =>
    route.fulfill({
      json: {
        data: {
          categories: [
            {
              categoryId: 1,
              name: '뷰티',
              children: [
                { categoryId: 11, name: '스킨케어' },
                { categoryId: 12, name: '메이크업' },
              ],
            },
          ],
        },
      },
    }),
  );
  await page.route(/\/products(?:\?.*)?$/, (route) =>
    handle(route, new URL(route.request().url()).searchParams),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();
}
async function select(page: Page, name = '김민지') {
  await page.getByRole('button', { name: /받는 사람 (선택|변경)/ }).click();
  const sheet = page.getByRole('dialog', { name: '받는 사람 선택' });
  await sheet
    .locator('.friend-card')
    .filter({ hasText: name })
    .getByRole('button', { name: '선택', exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
}
async function bottom(page: Page) {
  await page.getByTestId('mobile-scroll').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
}

test('수신자 선택으로 인증된 AI 조회, 추천·인기 순서와 다음 페이지를 유지한다', async ({
  page,
}) => {
  const requests: URLSearchParams[] = [];
  const ids = [105, 32, 981, ...Array.from({ length: 17 }, (_, i) => 200 + i)];
  await setup(page, async (route, params) => {
    requests.push(params);
    expect(route.request().headers().authorization).toBe('Bearer prototype-test-token');
    await route.fulfill({
      json: params.has('recipientUserId')
        ? params.has('cursor')
          ? result([871])
          : result(ids, 'AI_RECOMMENDED', 'opaque-ai-cursor')
        : result([1], 'POPULAR'),
    });
  });
  await expect(page.getByRole('radio', { name: 'AI 추천순' })).toBeDisabled();
  await select(page);
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'gifts');
  await expect(page.getByRole('radio', { name: 'AI 추천순' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('.product-card strong')).toHaveText(ids.map((id) => `상품 ${id}`));
  await bottom(page);
  await expect(page.locator('.product-card strong')).toHaveText(
    [...ids, 871].map((id) => `상품 ${id}`),
  );
  const next = requests.find((p) => p.has('cursor'))!;
  expect(next.get('cursor')).toBe('opaque-ai-cursor');
  expect(next.get('recipientUserId')).toBe('27');
  expect(next.get('sort')).toBe('AI_RECOMMENDED');
  await page.getByRole('radio', { name: '구매순' }).click();
  await expect.poll(() => requests.at(-1)?.get('sort')).toBe('MOST_GIFTED');
  expect(requests.at(-1)?.get('recipientUserId')).toBe('27');
  expect(requests.at(-1)?.has('cursor')).toBe(false);
  await page.getByRole('button', { name: '선택 해제' }).click();
  await expect(page.getByRole('radio', { name: 'AI 추천순' })).toBeDisabled();
  await expect.poll(() => requests.at(-1)?.get('sort')).toBe('POPULAR');
  expect(requests.at(-1)?.has('recipientUserId')).toBe(false);
});

test('fallback 안내 이후에도 AI 요청 정렬로 다음 페이지를 조회한다', async ({ page }) => {
  const requests: URLSearchParams[] = [];
  await setup(page, async (route, params) => {
    requests.push(params);
    await route.fulfill({
      json: result(
        params.has('cursor') ? [99] : Array.from({ length: 20 }, (_, i) => i + 1),
        'POPULAR',
        params.has('recipientUserId') && !params.has('cursor') ? 'fallback-cursor' : null,
      ),
    });
  });
  await select(page);
  await expect(page.getByRole('status')).toContainText('인기순으로 보여드려요');
  await bottom(page);
  await expect(page.locator('.product-card')).toHaveCount(21);
  expect(requests.at(-1)?.get('sort')).toBe('AI_RECOMMENDED');
  expect(requests.at(-1)?.get('cursor')).toBe('fallback-cursor');
});

test('커서 만료 시 기존 목록을 교체하고 첫 페이지를 한 번만 복구한다', async ({ page }) => {
  let firstPages = 0;
  let invalidRequests = 0;
  await setup(page, async (route, params) => {
    if (!params.has('recipientUserId')) return route.fulfill({ json: result([1], 'POPULAR') });
    if (params.has('cursor')) {
      invalidRequests++;
      return route.fulfill({ status: 400, json: failure('INVALID_CURSOR') });
    }
    firstPages++;
    await route.fulfill({
      json:
        firstPages === 1
          ? result(
              Array.from({ length: 20 }, (_, i) => i + 10),
              'AI_RECOMMENDED',
              'expired',
            )
          : result([999]),
    });
  });
  await select(page);
  await expect(page.locator('.product-card')).toHaveCount(20);
  await bottom(page);
  await expect(page.locator('.product-card strong')).toHaveText(['상품 999']);
  expect(firstPages).toBe(2);
  expect(invalidRequests).toBe(1);
});

test('검색·복수 카테고리 변경은 수신자를 유지하고 첫 페이지로 초기화한다', async ({ page }) => {
  const requests: URLSearchParams[] = [];
  await setup(page, async (route, params) => {
    requests.push(params);
    await route.fulfill({
      json: result([105], params.has('recipientUserId') ? 'AI_RECOMMENDED' : 'POPULAR'),
    });
  });
  await select(page);
  await page.getByPlaceholder('상품명 또는 브랜드를 입력해 주세요.').fill('크림');
  await expect.poll(() => requests.at(-1)?.get('query')).toBe('크림');
  await page.getByRole('button', { name: '필터', exact: true }).click();
  await page.getByRole('button', { name: '뷰티', exact: true }).click();
  await page.locator('.category-child-row').filter({ hasText: '스킨케어' }).click();
  await page.locator('.category-child-row').filter({ hasText: '메이크업' }).click();
  await page.getByRole('button', { name: '2개 적용하기' }).click();
  await expect.poll(() => requests.at(-1)?.get('categoryIds')).toBe('11,12');
  expect(requests.at(-1)?.get('recipientUserId')).toBe('27');
  expect(requests.at(-1)?.get('sort')).toBe('AI_RECOMMENDED');
  expect(requests.at(-1)?.get('query')).toBe('크림');
  expect(requests.at(-1)?.has('cursor')).toBe(false);
});

test('수신자 변경 후 이전 수신자의 늦은 응답을 무시한다', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let oldStarted = false;
  await setup(page, async (route, params) => {
    if (params.get('recipientUserId') === '27') {
      oldStarted = true;
      await gate;
      await route.fulfill({ json: result([27]) });
    } else await route.fulfill({ json: result([params.get('recipientUserId') === '28' ? 28 : 1]) });
  });
  await select(page);
  await expect.poll(() => oldStarted).toBe(true);
  await select(page, '이준호');
  await expect(page.locator('.product-card strong')).toHaveText(['상품 28']);
  release();
  await page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get('recipientUserId') === '27',
  );
  await expect(page.locator('.product-card strong')).toHaveText(['상품 28']);
});

for (const [status, code] of [
  [404, 'RECIPIENT_NOT_FOUND'],
  [401, 'UNAUTHORIZED'],
] as const) {
  test(`${code} 오류 시 수신자 안내 또는 로그인으로 복구한다`, async ({ page }) => {
    await setup(page, async (route, params) =>
      route.fulfill(
        params.has('recipientUserId')
          ? { status, json: failure(code) }
          : { json: result([1], 'POPULAR') },
      ),
    );
    await select(page);
    if (status === 404)
      await expect(page.getByRole('alert')).toContainText('받는 사람을 다시 선택');
    else await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
  });
}

test('빈 fallback 결과를 빈 목록으로 표시한다', async ({ page }) => {
  await setup(page, async (route) => route.fulfill({ json: result([], 'POPULAR') }));
  await select(page);
  await expect(page.getByRole('status')).toContainText('인기순으로 보여드려요');
  await expect(page.locator('.cursor-status')).toHaveText('일치하는 상품이 없어요');
  await expect(page.locator('.product-card')).toHaveCount(0);
});

test('복구 이후 커서가 다시 만료되면 자동 재조회 반복을 중단한다', async ({ page }) => {
  let firstPages = 0;
  let invalidRequests = 0;
  await setup(page, async (route, params) => {
    if (!params.has('recipientUserId')) return route.fulfill({ json: result([1], 'POPULAR') });
    if (params.has('cursor')) {
      invalidRequests++;
      return route.fulfill({ status: 400, json: failure('INVALID_CURSOR') });
    }
    firstPages++;
    await route.fulfill({
      json: result(
        Array.from({ length: 20 }, (_, i) => i + 10),
        'AI_RECOMMENDED',
        'expired',
      ),
    });
  });
  await select(page);
  await expect(page.locator('.product-card')).toHaveCount(20);
  await bottom(page);
  await expect.poll(() => firstPages).toBe(2);
  await expect(page.locator('.product-card')).toHaveCount(20);
  await bottom(page);
  await expect(page.locator('.cursor-status')).toContainText('조회할 수 없습니다.');
  await expect(page.locator('.product-card')).toHaveCount(0);
  expect(firstPages).toBe(2);
  expect(invalidRequests).toBe(2);
});
