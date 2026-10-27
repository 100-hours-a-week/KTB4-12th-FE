import { expect, test } from '@playwright/test';

test('앱 mock 설정에서도 룰렛은 서버 참여권과 추첨만 사용한다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('accessToken', 'roulette-test-token');
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem(
      'authUser',
      JSON.stringify({ userId: 1, name: '테스트', email: 'test@example.com' }),
    );
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let spins = 0;
  let fail = true;
  const status = {
    date: '2026-10-27',
    serverTime: '2026-10-27T10:00:00Z',
    nextResetAt: '2026-10-28T00:00:00+09:00',
    attendanceGranted: 1,
    giftGranted: 0,
    used: 0,
    remaining: 1,
    dailyRemaining: 1,
    rewardVersion: 'coupon-v3',
    segments: [17.5, 15, 16.67, 17.5, 16.67, 16.66].map((probability, segmentId) => ({
      segmentId,
      probability,
      rewardType: [0, 1, 3].includes(segmentId) ? 'COUPON' : 'MISS',
      multiplier: segmentId === 1 ? 3 : [0, 3].includes(segmentId) ? 2 : null,
    })),
  };
  await page.route('**/roulette/attendance', (route) =>
    route.fulfill({ json: { data: { ...status, granted: false } } }),
  );
  await page.route('**/roulette', (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: {} }
        : {
            json: {
              data: { ...status, remaining: 1 - spins, used: spins, dailyRemaining: 1 - spins },
            },
          },
    ),
  );
  await page.route('**/roulette/spins', (route) => {
    spins++;
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    return route.fulfill({
      json: {
        data: {
          spinId: 1,
          date: status.date,
          segmentId: 1,
          rewardType: 'COUPON',
          multiplier: 3,
          rewardVersion: status.rewardVersion,
          remaining: 0,
        },
      },
    });
  });
  await page.goto('/roulette-event');
  await expect(page.getByRole('alert')).toHaveText('룰렛 이벤트를 준비 중이에요.');
  await expect(page.getByRole('button', { name: '룰렛 추첨 준비 중' })).toBeDisabled();
  expect(spins).toBe(0);
  fail = false;
  await page.getByRole('button', { name: '다시 확인' }).click();
  await expect(page.getByText('남은 참여권 1장')).toBeVisible();
  await expect(page.getByText('횟수 제한 없이 참여할 수 있어요')).toHaveCount(0);
  await page.getByRole('button', { name: '행운 돌리기', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('보상 3배 쿠폰');
  await expect(page.getByRole('button', { name: '한 번 더 돌리기' })).toHaveCount(0);
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByText('남은 참여권 0장')).toBeVisible();
  await expect(page.getByRole('button', { name: '오늘 참여 완료' })).toBeDisabled();
  expect(spins).toBe(1);
});
