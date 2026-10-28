import { expect, test } from '@playwright/test';

const participation = {
  date: '2026-10-26',
  nextResetAt: '2026-10-27T00:00:00+09:00',
  attendanceGranted: 1,
  giftGranted: 3,
  used: 0,
  remaining: 8,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('accessToken')) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('accessToken', 'roulette-test-token');
    localStorage.setItem('prototype-auth', 'signed-in');
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
          giftSummary: { sentCount: 0, receivedCount: 0 },
        },
      },
    }),
  );
  await page.route('**/notifications/events', (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: ':keepalive\n\n' }),
  );
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ json: { data: { unreadCount: 0 } } }),
  );
  await page.route('**/roulette', (route) =>
    route.fulfill({
      json: {
        data: {
          ...participation,
          serverTime: '2026-10-26T10:00:00Z',
        },
      },
    }),
  );
});

test('서버 참여권을 표시하고 반복 출석에도 잔액을 임의로 늘리거나 추첨하지 않는다', async ({
  page,
}) => {
  let attendance = 0;
  await page.route('**/roulette/attendance', (route) => {
    attendance++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers().authorization).toBe('Bearer roulette-test-token');
    return route.fulfill({ json: { data: { ...participation, granted: false } } });
  });
  await page.goto('/roulette-event');
  await expect(page.getByText('남은 참여권 8장')).toBeVisible();
  await expect(page.getByText(/오늘 사용/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '룰렛 추첨 준비 중' })).toBeDisabled();
  const before = attendance;
  await page.getByRole('button', { name: '참여권 새로고침' }).click();
  await expect.poll(() => attendance).toBe(before + 1);
  await expect(page.getByText('남은 참여권 8장')).toBeVisible();
  await expect(page.getByText('오늘의 행운 도착!')).toHaveCount(0);
});

test('출석 장애를 화면에서 재시도하고 성공한 서버 상태로 복구한다', async ({ page }) => {
  let fail = true;
  await page.route('**/roulette/attendance', (route) =>
    route.fulfill(
      fail
        ? {
            status: 500,
            json: { message: '출석 처리 실패', error: { code: 'INTERNAL_SERVER_ERROR' } },
          }
        : { json: { data: { ...participation, granted: true } } },
    ),
  );
  await page.goto('/roulette-event');
  await expect(page.getByRole('alert')).toHaveText('출석 처리 실패');
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe(
    'roulette-test-token',
  );
  fail = false;
  await page.getByRole('button', { name: '다시 확인' }).click();
  await expect(page.getByText('남은 참여권 8장')).toBeVisible();
});

test('이벤트 비활성 상태를 안내하고 가짜 참여권이나 결과를 표시하지 않는다', async ({ page }) => {
  await page.route('**/roulette/attendance', (route) =>
    route.fulfill({
      status: 503,
      json: { message: '룰렛 이벤트를 준비 중입니다.', error: { code: 'SERVICE_UNAVAILABLE' } },
    }),
  );
  await page.goto('/roulette-event');
  await expect(page.getByRole('alert')).toHaveText('룰렛 이벤트를 준비 중이에요.');
  await expect(page.getByText(/남은 참여권 \d+장/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '룰렛 추첨 준비 중' })).toBeDisabled();
});

test('서버 잔액을 표시하고 오늘 사용 횟수는 표시하지 않는다', async ({ page }) => {
  await page.route('**/roulette/attendance', (route) =>
    route.fulfill({ json: { data: { ...participation, granted: false } } }),
  );
  await page.route('**/roulette', (route) =>
    route.fulfill({
      json: {
        data: {
          ...participation,
          remaining: 5,
          used: 1,
          serverTime: '2026-10-26T10:00:00Z',
        },
      },
    }),
  );
  await page.goto('/roulette-event');
  await expect(page.getByText('남은 참여권 5장')).toBeVisible();
  await expect(page.getByText(/오늘 사용/)).toHaveCount(0);
});

test('한국 시간 자정에 서버 기준으로 출석과 참여 현황을 다시 확인한다', async ({ page }) => {
  await page.clock.install();
  let statusRequests = 0;
  await page.route('**/roulette/attendance', (route) =>
    route.fulfill({ json: { data: { ...participation, granted: false } } }),
  );
  await page.route('**/roulette', (route) => {
    statusRequests++;
    return route.fulfill({
      json: {
        data:
          statusRequests === 1
            ? {
                ...participation,
                used: 1,
                serverTime: '2026-10-26T14:59:59Z',
              }
            : {
                ...participation,
                date: '2026-10-27',
                remaining: 9,
                nextResetAt: '2026-10-28T00:00:00+09:00',
                serverTime: '2026-10-26T15:00:01Z',
              },
      },
    });
  });
  await page.goto('/roulette-event');
  await expect(page.getByText(/오늘 사용/)).toHaveCount(0);
  await page.clock.fastForward(2100);
  await expect(page.getByText('남은 참여권 9장')).toBeVisible();
  await expect(page.getByText(/오늘 사용/)).toHaveCount(0);
});

test('인증된 앱 첫 접속과 탭 복귀에서 출석을 확인한다', async ({ page }) => {
  let attendance = 0;
  await page.route('**/roulette/attendance', (route) => {
    attendance++;
    return route.fulfill({ json: { data: { ...participation, granted: false } } });
  });
  await page.goto('/');
  await expect.poll(() => attendance).toBeGreaterThan(0);
  const before = attendance;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect.poll(() => attendance).toBe(before + 1);
});

test('미인증 사용자는 로그인 화면으로 이동하고 출석을 요청하지 않는다', async ({ page }) => {
  let attendance = 0;
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('prototype-auth', 'signed-out');
  });
  await page.route('**/roulette/attendance', (route) => {
    attendance++;
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/roulette-event');
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  expect(attendance).toBe(0);
});

const board = {
  rewardVersion: 'coupon-v3',
  segments: [
    { segmentId: 0, rewardType: 'COUPON', multiplier: 2, probability: 17.5 },
    { segmentId: 1, rewardType: 'COUPON', multiplier: 3, probability: 15 },
    { segmentId: 2, rewardType: 'MISS', multiplier: null, probability: 16.67 },
    { segmentId: 3, rewardType: 'COUPON', multiplier: 2, probability: 17.5 },
    { segmentId: 4, rewardType: 'MISS', multiplier: null, probability: 16.67 },
    { segmentId: 5, rewardType: 'MISS', multiplier: null, probability: 16.66 },
  ],
};
const spinResult = {
  spinId: 12,
  date: participation.date,
  segmentId: 1,
  rewardType: 'COUPON',
  multiplier: 3,
  rewardVersion: 'coupon-v3',
  remaining: 7,
};
const pendingKey = 'roulette-pending-spin:v1:1';

test.describe('서버 추첨', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/roulette/attendance', (route) =>
      route.fulfill({ json: { data: { ...participation, granted: false } } }),
    );
    await page.route('**/roulette', (route) =>
      route.fulfill({
        json: { data: { ...participation, ...board, serverTime: '2026-10-26T10:00:00Z' } },
      }),
    );
  });

  test('판의 실제 칸 각도와 글자 위치를 서버 확률에 맞춘다', async ({ page }) => {
    await page.goto('/roulette-event');
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
    const sectors = page.locator('.roulette-prize-label');
    const widths = await sectors.evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute('data-sector-angle'))),
    );
    expect(widths).toEqual([63, 54, 60.012, 63, 60.012, 59.976]);
    expect(widths[0] + widths[3]).toBeCloseTo(360 * 0.35, 6);
    expect(widths[1]).toBeCloseTo(360 * 0.15, 6);
    expect(widths[2] + widths[4] + widths[5]).toBeCloseTo(360 * 0.5, 6);
    await expect(page.locator('.roulette-disc')).toHaveCSS('border-radius', '50%');
    expect(
      await page
        .locator('.roulette-disc')
        .evaluate((node) => getComputedStyle(node).backgroundImage),
    ).toContain('conic-gradient');
    await page.waitForFunction(() => {
      const frame = document.querySelector<HTMLImageElement>('.roulette-frame');
      return frame?.complete && frame.naturalWidth > 0;
    });
    await page.screenshot({ path: '/private/tmp/roulette-proportional-board.png' });
  });

  test('회전 도중 확률 새로고침은 당첨 판을 바꾸지 않고 결과 확인 후 반영한다', async ({
    page,
  }) => {
    let changed = false;
    await page.route('**/roulette', (route) =>
      route.fulfill({
        json: {
          data: {
            ...participation,
            ...board,
            segments: changed
              ? board.segments.map((segment, index) => ({
                  ...segment,
                  probability: [10, 20, 10, 20, 20, 20][index],
                }))
              : board.segments,
            serverTime: '2026-10-26T10:00:00Z',
          },
        },
      }),
    );
    await page.route('**/roulette/spins', (route) => {
      changed = true;
      return route.fulfill({ json: { data: spinResult } });
    });
    await page.goto('/roulette-event');
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('보상 3배 쿠폰');
    await expect(page.locator('.roulette-prize-label').first()).toHaveAttribute(
      'data-sector-angle',
      '63',
    );
    await expect(page.locator('.roulette-disc')).toHaveAttribute('style', /rotate\(2821\.5deg\)/);
    const winningLabel = await page.locator('.roulette-prize-label').nth(1).boundingBox();
    const assembly = await page.locator('.roulette-assembly').boundingBox();
    expect(winningLabel).not.toBeNull();
    expect(assembly).not.toBeNull();
    expect(winningLabel!.x + winningLabel!.width / 2).toBeCloseTo(
      assembly!.x + assembly!.width / 2,
      0,
    );
    expect(winningLabel!.y).toBeLessThan(assembly!.y + assembly!.height / 2);
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await expect(page.locator('.roulette-prize-label').first()).toHaveAttribute(
      'data-sector-angle',
      '36',
    );
  });

  test('서버가 정한 칸에 멈추고 쿠폰 지급과 최신 잔액을 표시한다', async ({ page }) => {
    let calls = 0;
    await page.route('**/roulette/spins', async (route) => {
      calls++;
      expect(route.request().method()).toBe('POST');
      expect(route.request().postData()).toBeNull();
      expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
      expect(route.request().headers().authorization).toBe('Bearer roulette-test-token');
      await page.route('**/roulette', (r) =>
        r.fulfill({
          json: {
            data: {
              ...participation,
              ...board,
              remaining: 7,
              used: 1,
              serverTime: '2026-10-26T10:00:00Z',
            },
          },
        }),
      );
      await route.fulfill({ json: { data: spinResult } });
    });
    await page.goto('/roulette-event');
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('보상 3배 쿠폰');
    await expect(page.locator('.roulette-disc')).toHaveAttribute('style', /rotate\(2821\.5deg\)/);
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await expect(page.getByText('남은 참여권 7장')).toBeVisible();
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
    expect(calls).toBe(1);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), pendingKey)).toBeNull();
    await page.getByRole('button', { name: '이벤트 이용안내' }).click();
    await expect(page.getByText('6번 칸 · 꽝 · 16.66%')).toBeVisible();
    await page.screenshot({ path: '/private/tmp/roulette-coupon-v3-rules.png' });
  });

  test('응답 유실 후 새로고침해도 같은 키로 결과를 복구한다', async ({ page }) => {
    const keys: string[] = [];
    await page.route('**/roulette/spins', (route) => {
      keys.push(route.request().headers()['idempotency-key']);
      return keys.length === 1
        ? route.abort('failed')
        : route.fulfill({ json: { data: spinResult } });
    });
    await page.goto('/roulette-event');
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('button', { name: '결과 다시 확인' })).toBeEnabled();
    const key = await page.evaluate((k) => sessionStorage.getItem(k), pendingKey);
    await page.route('**/roulette', (r) =>
      r.fulfill({
        json: {
          data: {
            ...participation,
            ...board,
            remaining: 7,
            used: 1,
            serverTime: '2026-10-26T10:00:00Z',
          },
        },
      }),
    );
    await page.reload();
    await page.getByRole('button', { name: '결과 다시 확인' }).click();
    await expect(page.getByRole('dialog')).toContainText('보상 3배 쿠폰');
    expect(keys).toEqual([key, key]);
  });

  test('꽝도 서버 칸에 멈추고 참여 횟수를 소모한다', async ({ page }) => {
    await page.route('**/roulette/spins', (route) =>
      route.fulfill({
        json: { data: { ...spinResult, segmentId: 4, rewardType: 'MISS', multiplier: null } },
      }),
    );
    await page.goto('/roulette-event');
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('아쉽지만 꽝이에요');
    await expect(page.locator('.roulette-confetti')).toHaveCount(0);
    // CSSOM은 각도 문자열을 반올림하므로 숫자 오차와 실제 포인터 정렬을 함께 확인한다.
    const rotation = await page
      .locator('.roulette-disc')
      .evaluate((node) =>
        Number.parseFloat((node as HTMLElement).style.transform.replace('rotate(', '')),
      );
    expect(rotation).toBeCloseTo(2641.482, 2);
    const label = await page.locator('.roulette-prize-label').nth(4).boundingBox();
    const assembly = await page.locator('.roulette-assembly').boundingBox();
    expect(label).not.toBeNull();
    expect(assembly).not.toBeNull();
    expect(label!.x + label!.width / 2).toBeCloseTo(assembly!.x + assembly!.width / 2, 0);
    expect(label!.y).toBeLessThan(assembly!.y + assembly!.height / 2);
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
  });

  test('기존 박스 칸은 꽝으로 처리하고 화면에 랜덤박스를 표시하지 않는다', async ({ page }) => {
    await page.route('**/roulette/spins', (route) =>
      route.fulfill({
        json: { data: { ...spinResult, segmentId: 5, rewardType: 'MISS', multiplier: null } },
      }),
    );
    await page.goto('/roulette-event');
    await expect(page.locator('.roulette-prize-label')).toHaveCount(6);
    await expect(
      page.locator('.roulette-prize-label strong').filter({ hasText: '꽝' }),
    ).toHaveCount(3);
    await expect(page.getByText(/랜덤.?박스/)).toHaveCount(0);
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('아쉽지만 꽝이에요');
    await expect(page.locator('.roulette-confetti')).toHaveCount(0);
    // CSSOM은 각도 문자열을 반올림하므로 숫자 오차와 실제 포인터 정렬을 함께 확인한다.
    const rotation = await page
      .locator('.roulette-disc')
      .evaluate((node) =>
        Number.parseFloat((node as HTMLElement).style.transform.replace('rotate(', '')),
      );
    expect(rotation).toBeCloseTo(2581.488, 2);
    const label = await page.locator('.roulette-prize-label').nth(5).boundingBox();
    const assembly = await page.locator('.roulette-assembly').boundingBox();
    expect(label).not.toBeNull();
    expect(assembly).not.toBeNull();
    expect(label!.x + label!.width / 2).toBeCloseTo(assembly!.x + assembly!.width / 2, 0);
    expect(label!.y).toBeLessThan(assembly!.y + assembly!.height / 2);
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
  });

  test('참여권 부족 거절은 키를 정리하고 서버 상태를 다시 확인한다', async ({ page }) => {
    await page.route('**/roulette/spins', async (route) => {
      await page.route('**/roulette', (r) =>
        r.fulfill({
          json: {
            data: {
              ...participation,
              ...board,
              used: 1,
              remaining: 0,
              serverTime: '2026-10-26T10:00:00Z',
            },
          },
        }),
      );
      await route.fulfill({
        status: 409,
        json: {
          message: '사용 가능한 참여권이 없어요.',
          error: { code: 'ROULETTE_TICKET_NOT_AVAILABLE' },
        },
      });
    });
    await page.goto('/roulette-event');
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('사용 가능한 참여권이 없어요.');
    await expect(page.getByRole('button', { name: '참여권이 없어요' })).toBeDisabled();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), pendingKey)).toBeNull();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('잘못된 결과와 일시 장애는 새 추첨 없이 같은 키로 재확인한다', async ({ page }) => {
    const keys: string[] = [];
    await page.route('**/roulette/spins', (route) => {
      keys.push(route.request().headers()['idempotency-key']);
      return route.fulfill(
        keys.length === 1
          ? { json: { data: { ...spinResult, segmentId: 5 } } }
          : keys.length === 2
            ? { status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE' } } }
            : { json: { data: spinResult } },
      );
    });
    await page.goto('/roulette-event');
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('같은 요청');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '결과 다시 확인' }).click();
    await expect(page.getByRole('alert')).toContainText('잠시 후');
    await page.getByRole('button', { name: '결과 다시 확인' }).click();
    await expect(page.getByRole('dialog')).toContainText('보상 3배 쿠폰');
    expect(keys.length).toBe(3);
    expect(new Set(keys).size).toBe(1);
  });
  test('저장소에 요청 키를 보관하지 못하면 추첨을 전송하지 않는다', async ({ page }) => {
    let calls = 0;
    await page.route('**/roulette/spins', (route) => {
      calls++;
      return route.fulfill({ json: { data: spinResult } });
    });
    await page.goto('/roulette-event');
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('roulette-pending-spin:'))
          throw new Error('저장 공간을 사용할 수 없어요.');
        return original.call(this, key, value);
      };
    });
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('저장 공간');
    expect(calls).toBe(0);
  });

  test('중복 클릭은 요청 하나만 전송하고 로그아웃 후 늦은 결과를 표시하지 않는다', async ({
    page,
  }) => {
    let calls = 0;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/roulette/spins', async (route) => {
      calls++;
      await waiting;
      await route.fulfill({ json: { data: spinResult } });
    });
    await page.goto('/roulette-event');
    const button = page.getByRole('button', { name: '행운 돌리기', exact: true });
    await expect(button).toBeEnabled();
    await button.evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });
    await expect.poll(() => calls).toBe(1);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('prototype-auth', 'signed-out');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'accessToken', storageArea: localStorage }),
      );
    });
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
    release();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(calls).toBe(1);
  });

  test('추첨 토큰 만료는 인증 갱신 후 같은 키로 복구한다', async ({ page }) => {
    let refreshes = 0;
    const keys: string[] = [];
    await page.route('**/auth/refresh', (route) => {
      refreshes++;
      return route.fulfill({ json: { data: { accessToken: 'renewed-token', expiresIn: 3600 } } });
    });
    await page.route('**/roulette/spins', (route) => {
      keys.push(route.request().headers()['idempotency-key']);
      if (keys.length === 1)
        return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
      expect(route.request().headers().authorization).toBe('Bearer renewed-token');
      return route.fulfill({ json: { data: spinResult } });
    });
    await page.goto('/roulette-event');
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
    await page.evaluate(() =>
      localStorage.setItem('accessTokenExpiresAt', String(Date.now() - 1000)),
    );
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('보상 3배 쿠폰');
    expect(refreshes).toBe(1);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), pendingKey)).toBe(keys[0]);
  });

  test('추첨 대기 시간 초과 후 같은 키로 재확인하고 늦은 응답을 무시한다', async ({ page }) => {
    const keys: string[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/roulette/spins', async (route) => {
      keys.push(route.request().headers()['idempotency-key']);
      if (keys.length === 1) {
        await held;
        await route
          .fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } })
          .catch(() => undefined);
      } else await route.fulfill({ json: { data: spinResult } });
    });
    await page.goto('/roulette-event');
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
    await page.clock.install();
    await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
    await expect.poll(() => keys.length).toBe(1);
    await page.clock.fastForward(30_001);
    await expect(page.getByRole('button', { name: '결과 다시 확인' })).toBeEnabled();
    await expect(page.getByRole('alert')).toContainText('응답이 지연');
    await page.clock.resume();
    await page.getByRole('button', { name: '결과 다시 확인' }).click();
    await expect(page.getByRole('dialog')).toContainText('보상 3배 쿠폰');
    release();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe(
      'roulette-test-token',
    );
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
  });

  test('전날 결과를 복구해도 오늘 서버 잔액과 참여 한도를 덮어쓰지 않는다', async ({ page }) => {
    await page.goto('/roulette-event');
    await page.evaluate(
      (key) => sessionStorage.setItem(key, 'f119762f-ef96-401f-bfef-6f6e711694ca'),
      pendingKey,
    );
    await page.route('**/roulette', (route) =>
      route.fulfill({
        json: {
          data: {
            ...participation,
            ...board,
            date: '2026-10-27',
            remaining: 9,
            serverTime: '2026-10-27T10:00:00Z',
            nextResetAt: '2026-10-28T00:00:00+09:00',
          },
        },
      }),
    );
    await page.route('**/roulette/spins', (route) => route.fulfill({ json: { data: spinResult } }));
    await page.reload();
    await page.getByRole('button', { name: '결과 다시 확인' }).click();
    await expect(page.getByRole('dialog')).toContainText('보상 3배 쿠폰');
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await expect(page.getByText('남은 참여권 9장')).toBeVisible();
    await expect(page.getByRole('button', { name: '행운 돌리기', exact: true })).toBeEnabled();
  });
});

test('모바일에서 스크롤해도 헤더와 뒤로가기가 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/roulette/attendance', (route) =>
    route.fulfill({ json: { data: { ...participation, granted: false } } }),
  );
  await page.goto('/roulette-event');
  await expect(page.getByText('남은 참여권 8장')).toBeVisible();
  const header = page.locator('.roulette-event-page > .screen-header');
  const before = await header.boundingBox();
  await page.getByTestId('mobile-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(before?.y);
  await expect(page.getByRole('button', { name: '뒤로 가기', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: '이벤트 이용안내' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '확인했어요' }).click();
  await page.screenshot({ path: '/private/tmp/roulette-review-mobile.png' });
  await page.getByRole('button', { name: '뒤로 가기', exact: true }).click();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
});
