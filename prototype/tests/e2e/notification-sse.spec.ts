import { expect, test } from '@playwright/test';

const notification = {
  notificationId: 31,
  type: 'FRIEND_REQUEST_RECEIVED',
  title: '친구 요청이 도착했어요',
  message: '민지님이 친구 요청을 보냈어요. 🎁',
  referenceType: 'FRIEND_REQUEST',
  referenceId: 12,
  notifiedAt: '2026-10-13T12:00:00',
  isRead: false,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(`
    localStorage.clear();
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'test-token');
    const originalFetch = window.fetch.bind(window);
    window.sseConnections = 0;
    window.sseAborted = false;
    window.fetch = async (url, options) => {
      if (!String(url).endsWith('/notifications/events')) return originalFetch(url, options);
      window.sseConnections++;
      window.sseAuthorization = options.headers.Authorization;
      const stream = new ReadableStream({ start(controller) {
        window.sendSse = (text) => controller.enqueue(new TextEncoder().encode(text));
        window.endSse = () => controller.close();
        options.signal.addEventListener('abort', () => {
          window.sseAborted = true;
          try { controller.error(new DOMException('Aborted', 'AbortError')); } catch {}
        });
      }});
      return new Response(stream, {headers: {'Content-Type': 'text/event-stream'}});
    };
  `);
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 1,
          name: '나',
          email: 'me@example.com',
          birth: '2000-01-01',
          isBirthdayPublic: false,
          giftSummary: { sentCount: 0, receivedCount: 0 },
        },
      },
    }),
  );
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ json: { data: { unreadCount: 1 } } }),
  );
  await page.route(/\/notifications(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          items: [notification],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
  await page.route(/\/(friends|friend-requests\/received)(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          friends: [],
          items: [],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
  await page.goto('/');
  await page.waitForFunction('typeof window.sendSse === "function"');
});

test('SSE 인증, 분할 프레임, 잘못된 이벤트 무시, 중복 방지와 배너 클릭 이동', async ({ page }) => {
  expect(await page.evaluate('window.sseAuthorization')).toBe('Bearer test-token');
  const connections = await page.evaluate('window.sseConnections');
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    ':keepalive\n\nevent: notification\ndata: invalid\n\nevent: other\ndata: {}\n\n',
  );
  await expect(page.locator('.notification-banner')).toHaveCount(0);
  const frame = `event:notification\r\ndata:${JSON.stringify(notification)}\r\n\r\n`;
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    frame.slice(0, 50),
  );
  await expect(page.locator('.notification-banner')).toHaveCount(0);
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    frame.slice(50),
  );
  await expect(page.locator('.notification-banner')).toContainText(notification.message);
  await page.screenshot({ path: '/tmp/notification-banner-desktop.png' });
  await page.getByRole('button', { name: '알림 배너 닫기' }).click();
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    frame,
  );
  await expect(page.locator('.notification-banner')).toHaveCount(0);
  const next = { ...notification, notificationId: 32 };
  await page.route('**/notifications/32/read', (route) =>
    route.fulfill({ json: { data: { notificationId: 32, isRead: true, unreadCount: 0 } } }),
  );
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    `event:notification\ndata:${JSON.stringify(next)}\n\n`,
  );
  await page.locator('.notification-banner-content').click();
  await expect(page.getByRole('tab', { name: '받은 요청' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.notification-banner')).toHaveCount(0);
  await expect(page.locator('.notification-button span')).toHaveCount(0);
  expect(await page.evaluate('window.sseConnections')).toBe(connections);
});

test('배너 자동 닫기와 SSE 연결 종료 후 재연결', async ({ page }) => {
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    `event:notification\ndata:${JSON.stringify(notification)}\n\n`,
  );
  await expect(page.locator('.notification-banner')).toBeVisible();
  await expect(page.locator('.notification-banner')).toHaveCount(0, { timeout: 8000 });
  const connections = await page.evaluate('window.sseConnections');
  await page.evaluate('window.endSse()');
  await expect.poll(() => page.evaluate('window.sseConnections')).toBe(connections + 1);
});

test('알림 목록이 열려 있어도 SSE 수신 시 최신 목록 조회', async ({ page }) => {
  let listRequests = 0;
  await page.route(/\/notifications(?:\?.*)?$/, (route) => {
    listRequests++;
    return route.fulfill({
      json: { data: { items: [], pagination: { nextCursor: null, hasNext: false } } },
    });
  });
  await page.getByRole('button', { name: /알림 목록 열기/ }).click();
  await expect.poll(() => listRequests).toBe(1);
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    `event:notification\ndata:${JSON.stringify(notification)}\n\n`,
  );
  await expect.poll(() => listRequests).toBe(2);
});

test('기존 선물 완료 보상 알림에도 보상 크레딧을 표시한다', async ({ page }) => {
  await page.route(/\/notifications(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              ...notification,
              type: 'GIFT_COMPLETED_REWARD',
              title: '보상이 지급되었어요',
              message: '롯데모바일교환권 5,000원 선물 완료 보상이 지급되었습니다.',
            },
          ],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );

  await page.getByRole('button', { name: /알림 목록 열기/ }).click();
  await expect(page.getByRole('dialog', { name: '알림', exact: true })).toContainText(
    '선물 완료 보상 100,000 크레딧이 지급되었습니다.',
  );
});

test('결제 완료 알림을 다른 알림과 동일하게 상단 배너로 표시한다', async ({ page }) => {
  const paymentCompleted = {
    ...notification,
    notificationId: 33,
    type: 'PAYMENT_COMPLETED',
    title: '결제가 완료되었어요',
    message: '선물 상품 결제가 완료되었습니다.',
    referenceType: 'PAYMENT',
    referenceId: 101,
  };

  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    `event:notification\ndata:${JSON.stringify(paymentCompleted)}\n\n`,
  );

  await expect(page.locator('.notification-banner')).toContainText(paymentCompleted.title);
  await expect(page.locator('.notification-banner')).toContainText(paymentCompleted.message);
});

test('로그아웃 시 연결과 배너 정리', async ({ page }) => {
  await page.route('**/auth/logout', (route) => route.fulfill({ json: { data: {} } }));
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    `event:notification\ndata:${JSON.stringify(notification)}\n\n`,
  );
  await page.evaluate('window.sseAborted = false');
  await page.getByRole('button', { name: '마이', exact: true }).click();
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.locator('.notification-banner')).toHaveCount(0);
  await page.waitForFunction('window.sseAborted');
});

test('모바일 배너는 화면 안에 표시되고 닫기 버튼을 누를 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    `event:notification\ndata:${JSON.stringify(notification)}\n\n`,
  );
  const banner = page.locator('.notification-banner');
  await expect(banner).toBeVisible();
  await expect.poll(async () => Math.round((await banner.boundingBox())!.y)).toBe(12);
  const bounds = await banner.boundingBox();
  expect(Math.round(bounds!.y)).toBe(12);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/notification-banner-mobile.png' });
  await page.getByRole('button', { name: '알림 배너 닫기' }).click();
  await expect(banner).toHaveCount(0);
});

test('기존 미읽음 알림은 목록에 유지하고 새 SSE 알림만 팝업으로 표시한다', async ({ page }) => {
  const existing = { ...notification, notificationId: 20, title: '이전 미읽음 알림' };
  let items = [existing];
  await page.route(/\/notifications(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { data: { items, pagination: { nextCursor: null, hasNext: false } } } }),
  );
  await page.getByRole('button', { name: /알림 목록 열기/ }).click();
  const list = page.getByRole('dialog', { name: '알림', exact: true });
  await expect(list.locator('.notification-card')).toHaveCount(1);
  await expect(list).toContainText(existing.title);
  await expect(page.locator('.notification-banner')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();

  items = [notification, existing];
  await page.evaluate(
    (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
    `event:notification\ndata:${JSON.stringify(notification)}\n\n`,
  );
  await expect(page.locator('.notification-banner')).toContainText(notification.title);
  await expect(page.locator('.notification-banner')).not.toContainText(existing.title);
  await expect(list).toBeHidden();
  await page.getByRole('button', { name: '알림 배너 닫기' }).click();
  await expect(page.locator('.notification-banner')).toHaveCount(0);
  await page.getByRole('button', { name: /알림 목록 열기/ }).click();
  await expect(list.locator('.notification-card')).toHaveCount(2);
  await expect(list).toContainText(existing.title);
  await expect(list).toContainText(notification.title);
  await expect(page.locator('.notification-banner')).toHaveCount(0);
});

test('재연결 시 열린 목록에서 연결 중 놓친 알림을 조회하고 배너는 띄우지 않는다', async ({
  page,
}) => {
  await page.getByRole('button', { name: /알림 목록 열기/ }).click();
  const list = page.getByRole('dialog', { name: '알림', exact: true });
  await expect(list.locator('.notification-card')).toHaveCount(1);
  const missed = { ...notification, notificationId: 40, title: '연결 중 놓친 알림' };
  await page.route(/\/notifications(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: { items: [missed, notification], pagination: { nextCursor: null, hasNext: false } },
      },
    }),
  );
  await page.evaluate('window.endSse()');
  await expect(list).toContainText(missed.title, { timeout: 6000 });
  await expect(list.locator('.notification-card')).toHaveCount(2);
  await expect(page.locator('.notification-banner')).toHaveCount(0);
});

for (const source of ['banner', 'list'] as const) {
  test(`${source} 읽음 처리 후 늦은 미읽음 조회 응답을 무시한다`, async ({ page }) => {
    await expect(page.locator('.notification-button span')).toHaveText('1');
    let releaseCount!: () => void;
    const pendingCount = new Promise<void>((resolve) => {
      releaseCount = resolve;
    });
    let delayed = false;
    let read = false;
    await page.route('**/notifications/unread-count', async (route) => {
      if (!delayed) {
        delayed = true;
        await pendingCount;
        await route.fulfill({ json: { data: { unreadCount: 9 } } });
        return;
      }
      await route.fulfill({ json: { data: { unreadCount: read ? 0 : 1 } } });
    });
    await page.route('**/notifications/31/read', (route) => {
      read = true;
      return route.fulfill({
        json: { data: { notificationId: 31, isRead: true, unreadCount: 0 } },
      });
    });
    const countRequest = page.waitForRequest('**/notifications/unread-count');
    await page.evaluate(
      (part) => (window as unknown as { sendSse: (text: string) => void }).sendSse(part),
      `event:notification\ndata:${JSON.stringify(notification)}\n\n`,
    );
    const staleRequest = await countRequest;
    if (source === 'banner') {
      await page.locator('.notification-banner-content').click();
    } else {
      await page.getByRole('button', { name: '알림 배너 닫기' }).click();
      await page.getByRole('button', { name: /알림 목록 열기/ }).click();
      await page.locator('.notification-card').click();
    }
    await expect(page.getByRole('tab', { name: '받은 요청' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('.notification-button span')).toHaveCount(0);
    const finished = page.waitForEvent('requestfinished', {
      predicate: (request) => request === staleRequest,
    });
    releaseCount();
    await finished;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.locator('.notification-button span')).toHaveCount(0);
  });
}
