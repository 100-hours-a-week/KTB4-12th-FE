import { expect, type Page, type Route, test } from '@playwright/test';

import type { ChatProduct, Turn } from '../../src/entities/chat';
import type { ProductDetail } from '../../src/entities/product';

const conversationId = '11111111-1111-4111-8111-111111111111';
const turnId = '22222222-2222-4222-8222-222222222222';
const recommendations = [
  { productId: 102, reason: 'AI 추천 이유 <b>그대로</b>' },
  { productId: 101, reason: '두 번째 이유' },
];
const completed = (products: ChatProduct[] = recommendations): Turn => ({
  turnId,
  status: 'COMPLETED',
  message: '선물 추천',
  lastEventId: 2,
  blocks: [
    { type: 'text', text: '추천해 드릴게요.' },
    ...(products.length ? [{ type: 'cards' as const, products }] : []),
  ],
});
const product = (id: number): ProductDetail => ({
  productId: id,
  brandName: '최신 브랜드',
  productName: `최신 상품 ${id}`,
  unitPrice: 32000 + id,
  images: [{ imageId: id, imageUrl: '/assets/app/green-tea-cream.png', displayOrder: 1 }],
  stockQuantity: 8,
  description: '상품 상세 설명',
});
const json = (route: Route, data: unknown) => route.fulfill({ json: { data } });
const error = (route: Route, status: number) =>
  route.fulfill({
    status,
    json: {
      message: '상품 오류',
      error: { code: status === 404 ? 'PRODUCT_NOT_FOUND' : 'INTERNAL_SERVER_ERROR' },
    },
  });
const card = (page: Page, id: number) => page.locator(`.ai-chat-card[data-product-id="${id}"]`);

async function setup(page: Page, turns = [completed()]) {
  await page.addInitScript(
    ({ turns, conversationId }) => {
      if (localStorage.getItem('accessToken')) return;
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem(
        'authUser',
        JSON.stringify({ userId: 1, name: '나', email: 'me@gift.local' }),
      );
      sessionStorage.setItem('gift-chat-active', '1');
      sessionStorage.setItem(
        'gift-chat:v1:1',
        JSON.stringify({
          version: 1,
          userId: 1,
          conversationId,
          recipient: { userId: 27, name: '김민지' },
          token: 'token',
          turns,
          pending: null,
          draft: '',
          scrollTop: 0,
        }),
      );
    },
    { turns, conversationId },
  );
  await page.route('**/users/me', (route) =>
    json(route, {
      userId: 1,
      name: '나',
      email: 'me@gift.local',
      birth: '2000-01-01',
      isBirthdayPublic: false,
      giftSummary: { sentCount: 0, receivedCount: 0 },
    }),
  );
  await page.route(/\/notifications(?:\/.*|\?.*)?$/, (route) =>
    json(route, {
      unreadCount: 0,
      notifications: [],
      pagination: { nextCursor: null, hasNext: false },
    }),
  );
  await page.route(/\/products\/\d+$/, (route) =>
    json(route, {
      product: product(Number(new URL(route.request().url()).pathname.split('/').at(-1))),
    }),
  );
}

test('AI 순서·이유와 최신 사진·가격을 표시하며 최종 턴/다른 턴의 동일 ID 조회는 중복하지 않는다', async ({
  page,
}) => {
  await setup(page, [
    completed(),
    { ...completed(), turnId: '33333333-3333-4333-8333-333333333333' },
  ]);
  const calls: number[] = [];
  await page.route(/\/products\/\d+$/, async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    calls.push(id);
    await new Promise((resolve) => setTimeout(resolve, id === 102 ? 150 : 0));
    return json(route, { product: product(id) });
  });
  await page.goto('/');
  await expect(card(page, 102).first()).toContainText('최신 상품 102');
  await expect(card(page, 102).first()).toContainText('32,102원');
  await expect(card(page, 102).first()).toContainText('AI 추천 이유 <b>그대로</b>');
  await expect(card(page, 102).first().getByRole('img')).toHaveAttribute(
    'src',
    product(102).images[0].imageUrl,
  );
  expect(
    await page
      .locator('.ai-chat-card')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-product-id'))),
  ).toEqual(['102', '101', '102', '101']);
  expect(calls.sort()).toEqual([101, 102]);
  await expect(page.locator('.ai-chat-card b')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 추천받기', exact: true })).toHaveCount(0);
});

for (const status of [403, 404, 500, 0]) {
  test(`상품별 ${status || '품절'}은 정상 카드와 대화를 유지하며 일시 오류만 재시도한다`, async ({
    page,
  }) => {
    await setup(page);
    let fail = true;
    await page.route('**/products/102', (route) =>
      fail
        ? status
          ? error(route, status)
          : json(route, { product: { ...product(102), stockQuantity: 0 } })
        : json(route, { product: product(102) }),
    );
    await page.goto('/');
    await expect(
      card(page, 101).getByRole('button', { name: '상품 보기', exact: true }),
    ).toBeEnabled();
    await expect(
      card(page, 102).getByRole('button', { name: '상품 보기', exact: true }),
    ).toBeDisabled();
    await expect(card(page, 102)).toContainText(
      status === 500
        ? '상품 정보를 확인하지 못했습니다'
        : status
          ? '접근할 수 없는 상품'
          : '품절된 상품',
    );
    await expect(page.locator('[data-status=COMPLETED]')).toContainText('추천해 드릴게요.');
    if (status === 500) {
      fail = false;
      await card(page, 102).getByRole('button', { name: '상품 정보 다시 시도' }).click();
      await expect(
        card(page, 102).getByRole('button', { name: '상품 보기', exact: true }),
      ).toBeEnabled();
    }
  });
}

for (const bad of ['wrong-id', 'invalid-price', 'virtual-id']) {
  test(`${bad} 상품은 검증 전 이동하지 않는다`, async ({ page }) => {
    await setup(page, [
      completed([{ productId: bad === 'virtual-id' ? 900000001 : 102, reason: '추천 이유' }]),
    ]);
    let calls = 0;
    await page.route(/\/products\/\d+$/, (route) => {
      calls++;
      return json(route, {
        product: {
          ...product(102),
          ...(bad === 'wrong-id' ? { productId: 101 } : { unitPrice: -1 }),
        },
      });
    });
    await page.goto('/');
    await expect(page.locator('.ai-chat-card')).toContainText(
      bad === 'virtual-id' ? '테스트용 추천 상품' : '상품 정보를 확인하지 못했습니다',
    );
    await expect(page.getByRole('button', { name: '상품 보기', exact: true })).toBeDisabled();
    expect(calls).toBe(bad === 'virtual-id' ? 0 : 1);
  });
}

test('이미지 오류에는 대체 이미지 표현을 사용한다', async ({ page }) => {
  await setup(page);
  await page.route('**/products/102', (route) =>
    json(route, {
      product: {
        ...product(102),
        images: [{ imageId: 1, imageUrl: '/missing-image.png', displayOrder: 0 }],
      },
    }),
  );
  await page.route('**/missing-image.png', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(card(page, 102).getByRole('img', { name: '상품 이미지 없음' })).toBeVisible();
  await expect(
    card(page, 102).getByRole('button', { name: '상품 보기', exact: true }),
  ).toBeEnabled();
});

for (const failure of ['sold-out', 'deleted', 'network']) {
  test(`상품 보기 직전 ${failure}이면 이동하지 않고 최신 상태를 안내한다`, async ({ page }) => {
    await setup(page);
    let calls = 0;
    await page.route('**/products/102', (route) => {
      if (++calls === 1) return json(route, { product: product(102) });
      return failure === 'sold-out'
        ? json(route, { product: { ...product(102), stockQuantity: 0 } })
        : error(route, failure === 'deleted' ? 404 : 500);
    });
    await page.goto('/');
    const view = card(page, 102).getByRole('button', { name: '상품 보기', exact: true });
    await expect(view).toBeEnabled();
    await view.click();
    await expect(card(page, 102)).toContainText(
      failure === 'sold-out'
        ? '품절된 상품'
        : failure === 'deleted'
          ? '접근할 수 없는 상품'
          : '상품 정보를 확인하지 못했습니다',
    );
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'ai-chat');
    expect(calls).toBe(2);
  });
}

test('상품 상세에 내부 ID로 이동하고 새로고침·뒤로 가기 후 대화/스크롤을 복원한다', async ({
  page,
}) => {
  const turn = completed();
  turn.blocks.unshift({ type: 'text', text: '긴 답변입니다.\n'.repeat(60) });
  await setup(page, [turn]);
  let calls = 0;
  await page.route('**/products/102', (route) => {
    calls++;
    return json(route, { product: product(102) });
  });
  await page.goto('/');
  const view = card(page, 102).getByRole('button', { name: '상품 보기', exact: true });
  await expect(view).toBeEnabled();
  const scroll = page.locator('[data-testid=mobile-scroll]:not(.route-preserved-scroll)');
  await scroll.evaluate((node) => {
    node.scrollTop = 150;
  });
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBe(150);
  await view.dispatchEvent('click');
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'product');
  await expect(page.locator('.product-detail')).toContainText('최신 상품 102');
  expect(calls).toBeGreaterThanOrEqual(2);
  await page.reload();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'product');
  await page.getByRole('button', { name: '뒤로 가기' }).dispatchEvent('click');
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'ai-chat');
  await expect(card(page, 102)).toContainText('최신 상품 102');
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBe(150);
  await expect(page.locator('.ai-chat-message.user')).toHaveCount(1);
});

test('텍스트 전용/결과 없음에서는 상품 API를 호출하지 않는다', async ({ page }) => {
  await setup(page, [completed([])]);
  let calls = 0;
  await page.route(/\/products\/\d+$/, (route) => {
    calls++;
    return json(route, { product: product(101) });
  });
  await page.goto('/');
  await expect(page.locator('[data-status=COMPLETED]')).toContainText('추천해 드릴게요.');
  await expect(page.locator('.ai-chat-card')).toHaveCount(0);
  expect(calls).toBe(0);
});

test('추가 조건은 같은 대화의 새 턴이며 중간 cards/최종 Turn 교체는 최종 순서·이유를 따른다', async ({
  page,
}) => {
  await setup(page);
  const requests: string[] = [],
    lookups: number[] = [];
  await page.route(/\/products\/\d+$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    lookups.push(id);
    return json(route, { product: product(id) });
  });
  let id = '';
  await page.route('**/recommendations/conversations/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    expect(path.split('/')[3]).toBe(conversationId);
    id = path.split('/')[5] ?? '';
    if (!id)
      return json(route, { conversationId, conversationToken: 'token', turns: [completed()] });
    if (path.endsWith('/events')) return route.abort();
    requests.push(id);
    return json(route, {
      ...completed(),
      turnId: id,
      message: '5만원 이하로 추천해줘',
      status: 'PROCESSING',
      blocks: [],
      lastEventId: 0,
    });
  });
  await page.goto('/');
  await expect(card(page, 102)).toContainText('최신 상품 102');
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (url, options) => {
      if (!String(url).includes('/events?')) return original(url, options);
      const turnId = String(url).split('/turns/')[1].split('/')[0];
      const encode = (id: number, event: string, data: unknown) =>
        new TextEncoder().encode(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encode(1, 'cards', {
                products: [
                  { productId: 101, reason: '중간 이유' },
                  { productId: 103, reason: '중간 신규' },
                ],
              }),
            );
            setTimeout(() => {
              controller.enqueue(
                encode(2, 'turn.finished', {
                  turnId,
                  status: 'COMPLETED',
                  message: '5만원 이하로 추천해줘',
                  lastEventId: 2,
                  blocks: [
                    {
                      type: 'cards',
                      products: [
                        { productId: 103, reason: '최종 신규 이유' },
                        { productId: 101, reason: '최종 이전 이유' },
                      ],
                    },
                  ],
                }),
              );
              controller.close();
            }, 1000);
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    };
  });
  await page.getByLabel('채팅 메시지').fill('5만원 이하로 추천해줘');
  await page.getByRole('button', { name: '메시지 전송' }).click();
  await expect(page.locator('[data-status=PROCESSING]')).toContainText('중간 이유');
  await expect(card(page, 102)).toContainText('최신 상품 102');
  await expect(page.locator('[data-status=COMPLETED]')).toHaveCount(2);
  expect(requests).toHaveLength(1);
  expect(requests[0]).not.toBe(turnId);
  const latest = page.locator('[data-turn-id]').last();
  await expect(latest).toContainText('최종 신규 이유');
  await expect(latest).not.toContainText('중간 이유');
  expect(
    await latest
      .locator('.ai-chat-card')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-product-id'))),
  ).toEqual(['103', '101']);
  expect(lookups.sort()).toEqual([101, 102, 103]);
});

for (const status of ['FAILED', 'CANCELLED'] as const) {
  test(`${status} 부분 추천 카드는 새로고침 뒤에도 유지한다`, async ({ page }) => {
    await setup(page, [
      {
        ...completed(),
        status,
        ...(status === 'FAILED' ? { error: { message: '생성 실패' } } : {}),
      },
    ]);
    await page.goto('/');
    await expect(card(page, 102)).toContainText('최신 상품 102');
    await expect(page.locator(`[data-status=${status}]`)).toContainText(
      'AI 추천 이유 <b>그대로</b>',
    );
    await page.reload();
    await expect(card(page, 102)).toContainText('최신 상품 102');
    await expect(page.locator(`[data-status=${status}]`)).toHaveCount(1);
  });
}

for (const width of [390, 1100]) {
  test(`긴 채팅에서 추천 버튼을 가리지 않고 헤더 고정과 뒤로가기를 유지한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    const turn = completed();
    turn.blocks.unshift({ type: 'text', text: '긴 추천 답변입니다.\n'.repeat(40) });
    await setup(page, [turn]);
    await page.goto('/');
    await expect(
      card(page, 101).getByRole('button', { name: '상품 보기', exact: true }),
    ).toBeEnabled();
    const controls = page.locator('.ai-chat-controls');
    const scroll = page.locator('[data-testid=mobile-scroll]:not(.route-preserved-scroll)');
    for (const height of [110, 240]) {
      await page.getByLabel('채팅 메시지').evaluate((node, height) => {
        node.style.height = `${height}px`;
      }, height);
      await expect
        .poll(async () => {
          const padding = await page
            .locator('.ai-chat-page')
            .evaluate((node) => parseFloat(getComputedStyle(node).paddingBottom));
          const box = await controls.boundingBox();
          return padding >= (box?.height ?? Infinity) + 32;
        })
        .toBe(true);
      await scroll.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expect
        .poll(async () => {
          const button = await card(page, 101)
            .getByRole('button', { name: '상품 보기', exact: true })
            .boundingBox();
          const composer = await controls.boundingBox();
          return !!button && !!composer && button.y + button.height <= composer.y - 8;
        })
        .toBe(true);
    }
    await expect
      .poll(async () => {
        const viewport = await scroll.boundingBox();
        const header = await page.locator('.ai-chat-page > .screen-header').boundingBox();
        return (
          !!viewport && !!header && Math.abs(header.y - viewport.y - (width === 390 ? 0 : 64)) <= 1
        );
      })
      .toBe(true);
    await expect(page.getByRole('heading', { name: '선잘알 봇', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '뒤로 가기', exact: true }).click();
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
  });
}
