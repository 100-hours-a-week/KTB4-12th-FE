import { expect, type Page, test } from '@playwright/test';

async function openReport(page: Page) {
  await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
  await page.getByRole('button', { name: '의견 남기기', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
  });
});

test('JWT 만료 시 같은 JSON과 ID로 익명 재시도하고 202 접수를 확인한다', async ({ page }) => {
  const requests: {
    authorization?: string;
    contentType?: string;
    body: Record<string, unknown>;
  }[] = [];
  await page.route('**/bug-report', async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    requests.push({
      authorization: request.headers().authorization,
      contentType: request.headers()['content-type'],
      body,
    });
    await route.fulfill(
      requests.length === 1
        ? { status: 401 }
        : {
            status: 202,
            json: { data: { reportId: body.reportId } },
          },
    );
  });
  await page.goto('/');
  await openReport(page);
  await expect(page.getByText('스크린샷 첨부')).toHaveCount(0);
  await page.getByRole('textbox').fill('인증 제보 테스트');
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect(page.getByText('의견이 접수됐어요. 감사합니다!')).toBeVisible();
  expect(requests.map((request) => request.authorization)).toEqual([
    'Bearer prototype-test-token',
    undefined,
  ]);
  expect(requests.every((request) => request.contentType === 'application/json')).toBe(true);
  expect(requests[0].body).toEqual(requests[1].body);
  expect(requests[0].body.description).toBe('인증 제보 테스트');
  expect(requests[0].body.category).toBe('버그');
  expect(requests[0].body.reportId).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  expect(Object.keys(requests[0].body).sort()).toEqual([
    'category',
    'description',
    'pageUrl',
    'reportId',
    'reportedAt',
    'route',
    'userAgent',
    'viewport',
  ]);
});

test('503 후 수동 재시도는 본문과 ID를 유지하고 다음 제보는 새 ID를 만든다', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/bug-report', async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    await route.fulfill(
      bodies.length === 1
        ? { status: 503 }
        : {
            status: 202,
            json: { data: { reportId: body.reportId } },
          },
    );
  });
  await page.goto('/');
  await openReport(page);
  await page.getByRole('textbox').fill('실패 후 재시도');
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect(page.getByText('접수를 확인하지 못했어요. 다시 시도해 주세요.')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('실패 후 재시도');
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '의견 남기기' })).toHaveCount(0);
  expect(bodies[1]).toEqual(bodies[0]);
  await openReport(page);
  await page.getByRole('textbox').fill('새 제보');
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect.poll(() => bodies.length).toBe(3);
  expect(bodies[2].reportId).not.toBe(bodies[0].reportId);
});

for (const invalid of ['204', 'wrong-id']) {
  test(`${invalid} 응답은 접수 성공으로 표시하지 않는다`, async ({ page }) => {
    await page.route('**/bug-report', (route) =>
      route.fulfill(
        invalid === '204'
          ? { status: 204 }
          : { status: 202, json: { data: { reportId: 'wrong-id' } } },
      ),
    );
    await page.goto('/');
    await openReport(page);
    await page.getByRole('textbox').fill('응답 검증');
    await page.getByRole('button', { name: '전송', exact: true }).click();
    await expect(page.getByText('접수를 확인하지 못했어요. 다시 시도해 주세요.')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveValue('응답 검증');
  });
}

test('UTF-8 10KB 초과 내용은 자르거나 전송하지 않는다', async ({ page }) => {
  let requests = 0;
  await page.route('**/bug-report', (route) => {
    requests++;
    return route.fulfill({ status: 503 });
  });
  await page.goto('/');
  await openReport(page);
  await page.getByRole('textbox').fill('가'.repeat(4000));
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect(page.getByText('의견 내용이 너무 길어요. 내용을 줄여 주세요.')).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole('textbox')).toHaveValue('가'.repeat(4000));
});

test('네트워크 응답 유실은 성공으로 표시하지 않고 같은 ID로 수동 재시도한다', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/bug-report', async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    if (bodies.length === 1) return route.abort('connectionreset');
    await route.fulfill({ status: 202, json: { data: { reportId: body.reportId } } });
  });
  await page.goto('/');
  await openReport(page);
  await page.getByRole('textbox').fill('네트워크 오류 후 재시도');
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect(page.getByText('접수를 확인하지 못했어요. 다시 시도해 주세요.')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('네트워크 오류 후 재시도');
  await expect(page.getByText('의견이 접수됐어요. 감사합니다!')).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect(page.getByText('의견이 접수됐어요. 감사합니다!')).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
});
