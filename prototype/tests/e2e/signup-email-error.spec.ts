import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-out');
    window.localStorage.removeItem('accessToken');
  });
});

test('이메일 인증 API를 호출하고 발급 토큰을 회원가입 요청에 전달한다', async ({ page }) => {
  const requests: Array<{
    path: string;
    body: unknown;
    authorization: string | undefined;
  }> = [];
  const terms = [
    {
      termId: 1,
      termCode: 'PRIVACY_COLLECTION_USE',
      title: '개인정보 수집 및 이용 동의서',
      version: 1,
      isRequired: true,
      content: '약관 본문',
    },
    {
      termId: 2,
      termCode: 'GIFT_HISTORY',
      title: '선물 송수신 이력 정보 수집 및 이용 동의서',
      version: 1,
      isRequired: true,
      content: '약관 본문',
    },
  ];
  await page.route(
    /\/auth\/(email-availability|email-verification-codes|email-verifications|terms|signup)(\?|$)/,
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.push({
        path,
        body: route.request().postDataJSON(),
        authorization: route.request().headers().authorization,
      });
      if (path === '/auth/email-availability')
        return route.fulfill({ json: { data: { available: true } } });
      if (path === '/auth/email-verification-codes')
        return route.fulfill({ json: { message: '이메일 인증번호를 발송했습니다.', data: {} } });
      if (path === '/auth/email-verifications')
        return route.fulfill({
          json: {
            message: '이메일 인증이 완료되었습니다.',
            data: { emailVerificationToken: 'signup-token-123', expiresIn: 600 },
          },
        });
      if (path === '/auth/terms') return route.fulfill({ json: { data: { terms } } });
      return route.fulfill({ status: 201, json: { data: { userId: 42 } } });
    },
  );

  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이름').fill('테스트');
  await page.getByRole('button', { name: '생년월일 선택' }).click();
  await page.getByLabel('출생 연도').selectOption('1995');
  await page.getByLabel('출생 월').selectOption('5');
  await page.getByLabel('출생 일').selectOption('17');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByLabel('이메일').fill('verified@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '인증번호 발송' }).click();
  await page.getByLabel('이메일 인증번호').fill('123456');
  await page.getByRole('button', { name: '인증 확인' }).click();
  await expect(page.getByRole('status')).toHaveText('이메일 인증 완료');
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page
    .getByRole('checkbox', { name: '(필수) 개인정보 수집 및 이용 동의서', exact: true })
    .check();
  await page
    .getByRole('checkbox', {
      name: '(필수) 선물 송수신 이력 정보 수집 및 이용 동의서',
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: '동의하고 회원가입' }).click();
  await expect(page.getByRole('status')).toHaveText('회원가입이 완료됐어요. 로그인해 주세요.');

  expect(requests.map(({ path }) => path).filter((path) => path !== '/auth/terms')).toEqual([
    '/auth/email-availability',
    '/auth/email-verification-codes',
    '/auth/email-verifications',
    '/auth/signup',
  ]);
  expect(requests.find(({ path }) => path === '/auth/email-verification-codes')?.body).toEqual({
    email: 'verified@gift.local',
  });
  expect(requests.find(({ path }) => path === '/auth/email-verifications')?.body).toEqual({
    email: 'verified@gift.local',
    code: '123456',
  });
  expect(requests.find(({ path }) => path === '/auth/signup')?.body).toMatchObject({
    emailVerificationToken: 'signup-token-123',
  });
  expect(requests.every(({ authorization }) => authorization == null)).toBe(true);
});

test('재발송 제한 응답의 Retry-After 시간을 사용한다', async ({ page }) => {
  await page.route('**/auth/email-availability', async (route) =>
    route.fulfill({ json: { data: { available: true } } }),
  );
  await page.route('**/auth/email-verification-codes', async (route) =>
    route.fulfill({
      status: 429,
      headers: { 'Retry-After': '120' },
      json: {
        message: '잠시 후 다시 시도해 주세요.',
        error: { code: 'TOO_MANY_REQUESTS' },
      },
    }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이메일').fill('rate-limited@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();
  await page.getByRole('button', { name: '인증번호 발송' }).click();

  await expect(page.getByRole('alert')).toHaveText('잠시 후 다시 시도해 주세요.');
  await expect(page.getByRole('button', { name: '재발송 120초' })).toBeDisabled();
});

test('이메일 중복 확인 중 서버 오류가 발생하면 완료 상태로 바뀌지 않는다', async ({ page }) => {
  await page.route('**/auth/email-availability', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          traceId: '01JXYZ8D7G5K2M4N6P8Q',
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이메일').fill('server-error@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
  );
  await expect(page.getByRole('button', { name: '중복확인' })).toBeEnabled();
  await expect(page.getByText('사용할 수 있는 이메일입니다.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
});

for (const status of [200, 401]) {
  test(`남은 토큰 없이 이메일 중복 확인하고 ${status} 응답에도 가입 화면을 유지한다`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'expired-token');
      localStorage.setItem('accessTokenExpiresAt', '1');
    });
    const authRequests: string[] = [];
    let authorization: string | undefined;
    await page.route(/\/auth\/(email-availability|refresh|logout)(\?|$)/, async (route) => {
      authRequests.push(new URL(route.request().url()).pathname);
      authorization = route.request().headers().authorization;
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(
          status === 200
            ? { data: { available: true } }
            : { message: '인증 오류', error: { code: 'UNAUTHORIZED' } },
        ),
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '회원가입' }).click();
    await page.getByLabel('이메일').fill('public-api@gift.local');
    await page.getByRole('button', { name: '중복확인' }).click();
    if (status === 200) {
      await expect(page.getByRole('button', { name: '중복확인' })).toBeVisible();
      await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
    } else {
      await expect(page.getByRole('alert')).toHaveText('인증 오류');
    }
    await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'signup');
    expect(authorization).toBeUndefined();
    expect(authRequests).toEqual(['/auth/email-availability']);
  });
}

for (const result of ['available', 'unavailable', 'error'] as const) {
  test(`이메일 변경 후 이전 ${result} 응답을 무시하고 현재 이메일을 다시 확인한다`, async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const checkedEmails: string[] = [];
    await page.route('**/auth/email-availability', async (route) => {
      const email = route.request().postDataJSON().email;
      checkedEmails.push(email);
      if (email === 'first@gift.local') {
        await gate;
        return route.fulfill({
          status: result === 'error' ? 500 : 200,
          json:
            result === 'error'
              ? { message: '이전 이메일 조회 실패', error: { code: 'INTERNAL_SERVER_ERROR' } }
              : { data: { available: result === 'available' } },
        });
      }
      return route.fulfill({ json: { data: { available: true } } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '회원가입' }).click();
    await page.getByLabel('이름').fill('테스트');
    await page.getByRole('button', { name: '생년월일 선택' }).click();
    await page.getByRole('button', { name: '선택 완료' }).click();
    await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
    await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
    await page.getByLabel('이메일').fill('first@gift.local');
    const oldRequest = page.waitForRequest('**/auth/email-availability');
    await page.getByRole('button', { name: '중복확인' }).click();
    await oldRequest;
    await page.getByLabel('이메일').fill('current@gift.local');
    const oldResponse = page.waitForResponse('**/auth/email-availability');
    release();
    await (await oldResponse).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.getByText('사용할 수 있는 이메일입니다.')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '중복확인' }).click();
    await expect(page.getByRole('button', { name: '중복확인' })).toBeVisible();
    await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
    expect(checkedEmails).toEqual(['first@gift.local', 'current@gift.local']);
  });
}

test('이전 요청의 종료가 새 이메일의 확인 중 상태를 해제하지 않는다', async ({ page }) => {
  let releaseOld!: () => void;
  let releaseCurrent!: () => void;
  const oldGate = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  const currentGate = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  await page.route('**/auth/email-availability', async (route) => {
    const old = route.request().postDataJSON().email === 'first@gift.local';
    await (old ? oldGate : currentGate);
    await route.fulfill({ json: { data: { available: true } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이메일').fill('first@gift.local');
  const oldRequest = page.waitForRequest('**/auth/email-availability');
  await page.getByRole('button', { name: '중복확인' }).click();
  await oldRequest;
  await page.getByLabel('이메일').fill('current@gift.local');
  const currentRequest = page.waitForRequest('**/auth/email-availability');
  await page.getByRole('button', { name: '중복확인' }).click();
  await currentRequest;
  const oldResponse = page.waitForResponse(
    (response) => response.request().postDataJSON()?.email === 'first@gift.local',
  );
  releaseOld();
  await (await oldResponse).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByRole('button', { name: '확인 중', exact: true })).toBeDisabled();
  releaseCurrent();
  await expect(page.getByRole('button', { name: '중복확인' })).toBeVisible();
});

test('가입 화면을 나간 후 도착한 응답은 가입 초안의 확인 상태를 바꾸지 않는다', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/auth/email-availability', async (route) => {
    await gate;
    await route.fulfill({ json: { data: { available: true } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이메일').fill('first@gift.local');
  const oldRequest = page.waitForRequest('**/auth/email-availability');
  await page.getByRole('button', { name: '중복확인' }).click();
  await oldRequest;
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
  const oldResponse = page.waitForResponse('**/auth/email-availability');
  release();
  await (await oldResponse).finished();
  await page.getByRole('button', { name: '회원가입' }).click();
  await expect(page.getByLabel('이메일')).toHaveValue('first@gift.local');
  await expect(page.getByText('사용할 수 있는 이메일입니다.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '중복확인' })).toBeEnabled();
});
