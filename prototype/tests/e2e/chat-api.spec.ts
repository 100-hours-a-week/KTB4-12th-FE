import { expect, type Page, type Route, test } from '@playwright/test';

import type { Turn } from '../../src/entities/chat/model';
const inputText = '생일 선물 추천해줘 🎁';
const finalTurn = (id: string, status: Turn['status'] = 'COMPLETED'): Turn => ({
  turnId: id,
  message: inputText,
  status,
  blocks: [{ type: 'text', text: '부분 답변 <b>🎁</b>' }],
  lastEventId: 2,
  ...(status === 'FAILED' ? { error: { message: '생성 실패' } } : {}),
});
async function setup(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem(
        'authUser',
        JSON.stringify({ userId: 1, name: '나', email: 'me@gift.local' }),
      );
    }
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 1,
          name: '나',
          email: 'me@gift.local',
          birth: '2000-01-01',
          isBirthdayPublic: false,
          giftSummary: { sentCount: 0, receivedCount: 0 },
        },
      },
    }),
  );
  await page.route(/\/notifications(?:\/.*|\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          unreadCount: 0,
          notifications: [],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          friends: [
            { friendId: 31, userId: 27, name: '김민지', email: 'friend@gift.local', birth: null },
          ],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
}
async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'AI 챗봇 및 버그 리포트 열기' }).click();
  await page.getByRole('button', { name: 'AI 선물 추천 열기' }).click();
  await page.getByRole('button', { name: '받는 사람 선택', exact: true }).click();
  await page
    .getByRole('dialog', { name: '받는 사람 선택', exact: true })
    .getByRole('button', { name: '선택', exact: true })
    .click();
}
async function send(page: Page) {
  await page.getByLabel('채팅 메시지').fill(inputText);
  await page.getByRole('button', { name: '메시지 전송' }).click();
}
const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, json: { message: '처리했습니다.', data } });
const error = (route: Route, status: number, code: string, message = '서버 오류 안내') =>
  route.fulfill({ status, json: { message, error: { code, traceId: 'test-trace' } } });
function event(id: number, name: string, data: unknown) {
  return `id: ${id}\nevent: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

test('접수 실패 후 동일 UUID·Body 재시도, 취소는 body 없이 실제 COMPLETED를 반영', async ({
  page,
}) => {
  await setup(page);
  const requests: Array<{ url: string; body: string | null }> = [];
  let turn: Turn | null = null;
  await page.route('**/recommendations/conversations/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const conversationId = url.pathname.split('/')[3];
    const turnId = url.pathname.split('/')[5];
    if (!turnId)
      return json(route, {
        conversationId,
        conversationToken: 'conversation-token',
        turns: turn ? [turn] : [],
      });
    expect(req.headers()['x-conversation-token']).toBe('conversation-token');
    if (url.pathname.endsWith('/cancellation')) {
      expect(req.method()).toBe('PUT');
      expect(req.postData()).toBeNull();
      expect(req.headers()['content-type']).toBeUndefined();
      turn = finalTurn(turnId);
      return json(route, turn);
    }
    if (url.pathname.endsWith('/events')) {
      expect(req.headers().accept).toBe('text/event-stream');
      expect(req.headers()['last-event-id']).toBeUndefined();
      expect(url.searchParams.get('afterEventId')).toBe('0');
      return route.fulfill({ contentType: 'text/event-stream', body: ': keep-alive\n\n' });
    }
    if (req.method() === 'GET') return json(route, turn);
    requests.push({ url: req.url(), body: req.postData() });
    if (requests.length === 1)
      return error(route, 400, 'INVALID_REQUEST', '입력값을 확인해 주세요.');
    turn = { ...finalTurn(turnId), status: 'PROCESSING', blocks: [], lastEventId: 0 };
    return json(route, turn, 202);
  });
  await open(page);
  await send(page);
  await expect(page.getByLabel('채팅 메시지')).toHaveValue(inputText);
  await expect(page.getByRole('status')).toHaveText('입력값을 확인해 주세요.');
  await page.getByRole('button', { name: '같은 질문 다시 보내기' }).click();
  await expect(page.getByLabel('채팅 메시지')).toHaveValue('');
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  await page.getByRole('button', { name: '답변 생성 정지' }).click();
  await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toContainText('<b>🎁</b>');
  expect(await page.locator('.ai-chat-thread b').count()).toBe(0);
});

for (const accepted of [true, false]) {
  test(`응답 유실: GET으로 ${accepted ? '접수 확인' : '미접수 확인 후 수동 재시도'}`, async ({
    page,
  }) => {
    await setup(page);
    const puts: Array<{ url: string; body: string | null }> = [];
    let turn: Turn | null = null;
    let gets = 0;
    await page.route('**/recommendations/conversations/**', (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        id = url.pathname.split('/')[5];
      if (!id)
        return json(route, {
          conversationId: url.pathname.split('/')[3],
          conversationToken: 'token',
          turns: turn ? [turn] : [],
        });
      if (req.method() === 'GET') {
        gets++;
        return turn ? json(route, turn) : error(route, 404, 'NOT_FOUND');
      }
      puts.push({ url: req.url(), body: req.postData() });
      if (puts.length === 1) {
        if (accepted) turn = finalTurn(id);
        return route.abort('failed');
      }
      turn = finalTurn(id);
      return json(route, turn);
    });
    await open(page);
    await send(page);
    if (!accepted) {
      await expect(page.getByRole('button', { name: '같은 질문 다시 보내기' })).toBeVisible();
      await expect(page.getByLabel('채팅 메시지')).toHaveValue(inputText);
      expect(puts).toHaveLength(1);
      await page.getByRole('button', { name: '같은 질문 다시 보내기' }).click();
      await expect.poll(() => puts.length).toBe(2);
      expect(puts[0]).toEqual(puts[1]);
    }
    await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toHaveCount(1);
    await expect(page.locator('.ai-chat-message.user')).toHaveCount(1);
    expect(gets).toBeGreaterThan(0);
    expect(puts).toHaveLength(accepted ? 1 : 2);
  });
}

for (const refreshAt of ['submit', 'events']) {
  test(`로그인 갱신 1회: ${refreshAt} UUID·요청·cursor 유지`, async ({ page }) => {
    await setup(page);
    let refreshes = 0,
      attempts = 0;
    const retried: Array<{ url: string; body: string | null }> = [];
    await page.route('**/auth/refresh', (route) => {
      refreshes++;
      return json(route, { accessToken: 'renewed-token', expiresIn: 3600 });
    });
    await page.route('**/recommendations/conversations/**', async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        id = url.pathname.split('/')[5];
      if (!id)
        return json(route, {
          conversationId: url.pathname.split('/')[3],
          conversationToken: 'conversation-token',
          turns: [],
        });
      const stream = url.pathname.endsWith('/events');
      const target = refreshAt === 'events' ? stream : req.method() === 'PUT';
      if (target) {
        attempts++;
        retried.push({ url: req.url(), body: req.postData() });
        if (attempts === 1) {
          return error(route, 401, 'UNAUTHORIZED');
        }
        expect(req.headers().authorization).toBe('Bearer renewed-token');
        expect(req.headers()['x-conversation-token']).toBe('conversation-token');
      }
      if (stream)
        return route.fulfill({
          contentType: 'text/event-stream',
          body:
            event(1, 'answer.delta', { delta: '부분' }) + event(2, 'turn.finished', finalTurn(id)),
        });
      return json(
        route,
        { ...finalTurn(id), status: 'PROCESSING', blocks: [], lastEventId: 0 },
        202,
      );
    });
    await open(page);
    await page.evaluate(() => localStorage.setItem('accessTokenExpiresAt', '0'));
    await send(page);
    await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toHaveCount(1);
    expect(refreshes).toBe(1);
    expect(attempts).toBe(2);
    expect(retried[0]).toEqual(retried[1]);
  });
}

for (const fault of ['gap', 'malformed', 'eof', 'duplicate']) {
  test(`SSE ${fault}: 전체 턴 재동기화·중복 답변 방지`, async ({ page }) => {
    await setup(page);
    let turn: Turn | null = null,
      gets = 0;
    await page.route('**/recommendations/conversations/**', (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        id = url.pathname.split('/')[5];
      if (!id)
        return json(route, {
          conversationId: url.pathname.split('/')[3],
          conversationToken: 'token',
          turns: turn ? [turn] : [],
        });
      if (url.pathname.endsWith('/events')) {
        turn = finalTurn(id);
        const body =
          fault === 'gap'
            ? event(2, 'answer.delta', { delta: '누락' })
            : fault === 'malformed'
              ? 'id: 1\nevent: answer.delta\ndata: nope\n\n'
              : fault === 'eof'
                ? event(1, 'answer.delta', { delta: '일부' })
                : event(1, 'answer.delta', { delta: '일부' }) +
                  event(1, 'answer.delta', { delta: '일부' }) +
                  event(2, 'turn.finished', turn);
        return route.fulfill({ contentType: 'text/event-stream', body });
      }
      if (req.method() === 'GET') {
        gets++;
        return json(route, turn);
      }
      turn = { ...finalTurn(id), status: 'PROCESSING', blocks: [], lastEventId: 0 };
      return json(route, turn, 202);
    });
    await open(page);
    await send(page);
    await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toHaveText(
      '🤖AI 챗봇부분 답변 <b>🎁</b>',
    );
    expect(gets).toBe(fault === 'duplicate' ? 0 : 1);
  });
}

test('만료 대화 토큰 404는 같은 대화를 재인증하고 새 토큰으로 복원', async ({ page }) => {
  await setup(page);
  let turn: Turn | null = null,
    recovers = 0,
    expired = false;
  const conversations: string[] = [];
  await page.route('**/recommendations/conversations/**', (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      id = url.pathname.split('/')[5];
    if (!id) {
      recovers++;
      conversations.push(url.pathname);
      return json(route, {
        conversationId: url.pathname.split('/')[3],
        conversationToken: recovers === 1 ? 'old' : 'new',
        turns: turn ? [turn] : [],
      });
    }
    if (url.pathname.endsWith('/events')) {
      turn = finalTurn(id);
      return route.fulfill({ contentType: 'text/event-stream', body: '' });
    }
    if (req.method() === 'GET') {
      if (!expired) {
        expired = true;
        return error(route, 404, 'NOT_FOUND');
      }
      expect(req.headers()['x-conversation-token']).toBe('new');
      return json(route, turn);
    }
    turn = { ...finalTurn(id), status: 'PROCESSING', blocks: [], lastEventId: 0 };
    return json(route, turn, 202);
  });
  await open(page);
  await send(page);
  await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toBeVisible();
  expect(recovers).toBe(2);
  expect(conversations[0]).toBe(conversations[1]);
});

for (const status of ['FAILED', 'CANCELLED'] as const) {
  test(`${status} 부분 답변은 새로고침 후에도 유지`, async ({ page }) => {
    await setup(page);
    let turn: Turn | null = null;
    await page.route('**/recommendations/conversations/**', (route) => {
      const url = new URL(route.request().url()),
        id = url.pathname.split('/')[5];
      if (!id)
        return json(route, {
          conversationId: url.pathname.split('/')[3],
          conversationToken: 'token',
          turns: turn ? [turn] : [],
        });
      turn = finalTurn(id, status);
      return json(route, turn);
    });
    await open(page);
    await send(page);
    await page.reload();
    await expect(page.locator(`.ai-chat-message[data-status=${status}]`)).toContainText(
      '부분 답변 <b>🎁</b>',
    );
  });
}

for (const heartbeat of [false, true]) {
  test(`60초 SSE idle${heartbeat ? '은 heartbeat마다 갱신한다' : ' 뒤 조회하여 복구한다'}`, async ({
    page,
  }) => {
    await setup(page);
    let turn: Turn | null = null,
      gets = 0;
    await page.route('**/recommendations/conversations/**', (route) => {
      const url = new URL(route.request().url()),
        id = url.pathname.split('/')[5];
      if (!id)
        return json(route, {
          conversationId: url.pathname.split('/')[3],
          conversationToken: 'token',
          turns: turn ? [turn] : [],
        });
      if (route.request().method() === 'GET') {
        gets++;
        turn = finalTurn(id);
        return json(route, turn);
      }
      turn = { ...finalTurn(id), status: 'PROCESSING', blocks: [], lastEventId: 0 };
      return json(route, turn, 202);
    });
    await open(page);
    await page.clock.install();
    await page.evaluate((withHeartbeat) => {
      const original = window.fetch;
      window.fetch = async (url, options) => {
        if (!String(url).includes('/events?')) return original(url, options);
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            options?.signal?.addEventListener(
              'abort',
              () => controller.error(new Error('aborted')),
              { once: true },
            );
            if (withHeartbeat)
              setTimeout(
                () => controller.enqueue(new TextEncoder().encode(': keep-alive\n\n')),
                30_000,
              );
          },
        });
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
      };
    }, heartbeat);
    await send(page);
    await expect(page.getByRole('button', { name: '답변 생성 정지' })).toBeVisible();
    await page.clock.fastForward(31_000);
    expect(gets).toBe(0);
    await page.clock.fastForward(31_000);
    if (heartbeat) {
      expect(gets).toBe(0);
      await expect(page.locator('.ai-chat-message[data-status=PROCESSING]')).toHaveCount(1);
      await page.clock.fastForward(31_000);
    }
    await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toHaveCount(1);
    expect(gets).toBe(1);
  });
}

test('인증 갱신 후 재차 401이면 한 번만 갱신하고 로그인으로 이동한다', async ({ page }) => {
  await setup(page);
  let refreshes = 0,
    puts = 0;
  await page.route('**/auth/refresh', (route) => {
    refreshes++;
    return json(route, { accessToken: 'renewed', expiresIn: 3600 });
  });
  await page.route('**/recommendations/conversations/**', (route) => {
    const url = new URL(route.request().url()),
      id = url.pathname.split('/')[5];
    if (!id)
      return json(route, {
        conversationId: url.pathname.split('/')[3],
        conversationToken: 'token',
        turns: [],
      });
    puts++;
    return error(route, 401, 'UNAUTHORIZED');
  });
  await open(page);
  await page.evaluate(() => localStorage.setItem('accessTokenExpiresAt', '0'));
  await send(page);
  await expect(page.locator('[data-testid=gift-app]')).toHaveAttribute('data-route', 'login');
  expect(refreshes).toBe(1);
  expect(puts).toBe(2);
  expect(await page.evaluate(() => sessionStorage.getItem('gift-chat:v1:1'))).toBeNull();
});

test('AI 대화가 사라지면 안내 후 새 대화 UUID를 준비하며 질문을 자동 전송하지 않는다', async ({
  page,
}) => {
  await setup(page);
  let recovers = 0,
    puts = 0;
  await page.route('**/recommendations/conversations/**', (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      id = url.pathname.split('/')[5];
    if (!id) {
      recovers++;
      return json(route, {
        conversationId: url.pathname.split('/')[3],
        conversationToken: 'token',
        turns: [],
      });
    }
    if (url.pathname.endsWith('/events'))
      return route.fulfill({ contentType: 'text/event-stream', body: '' });
    if (req.method() === 'GET') return error(route, 404, 'NOT_FOUND');
    puts++;
    return json(route, { ...finalTurn(id), status: 'PROCESSING', blocks: [], lastEventId: 0 }, 202);
  });
  await open(page);
  await send(page);
  await expect(page.getByRole('status')).toContainText('AI 서버에 기존 대화가 없어');
  await expect(page.getByLabel('채팅 메시지')).toHaveValue(inputText);
  expect(recovers).toBe(2);
  expect(puts).toBe(1);
  await expect(page.getByRole('button', { name: '메시지 전송' })).toBeEnabled();
});

test('취소 시 만료 대화 토큰을 재인증하고 실제 CANCELLED 상태를 반영한다', async ({ page }) => {
  await setup(page);
  let turn: Turn | null = null,
    recovers = 0,
    cancels = 0;
  await page.route('**/recommendations/conversations/**', (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      id = url.pathname.split('/')[5];
    if (!id) {
      recovers++;
      return json(route, {
        conversationId: url.pathname.split('/')[3],
        conversationToken: recovers === 1 ? 'old' : 'new',
        turns: turn ? [turn] : [],
      });
    }
    if (url.pathname.endsWith('/cancellation')) {
      cancels++;
      expect(req.postData()).toBeNull();
      if (cancels === 1) return error(route, 404, 'NOT_FOUND');
      expect(req.headers()['x-conversation-token']).toBe('new');
      turn = finalTurn(id, 'CANCELLED');
      return json(route, turn);
    }
    if (url.pathname.endsWith('/events'))
      return route.fulfill({ contentType: 'text/event-stream', body: '' });
    if (req.method() === 'GET')
      return req.headers()['x-conversation-token'] === 'old' && cancels > 0
        ? error(route, 404, 'NOT_FOUND')
        : json(route, turn);
    turn = { ...finalTurn(id), status: 'PROCESSING', blocks: [], lastEventId: 0 };
    return json(route, turn, 202);
  });
  await open(page);
  await send(page);
  await page.getByRole('button', { name: '답변 생성 정지' }).click();
  await expect(page.locator('.ai-chat-message[data-status=CANCELLED]')).toContainText('부분 답변');
  expect(recovers).toBe(2);
  expect(cancels).toBe(2);
});
