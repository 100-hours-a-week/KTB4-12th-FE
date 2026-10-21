import { expect, test } from '@playwright/test';

const signupTerms = [
  {
    termId: 1,
    termCode: 'PRIVACY_COLLECTION_USE',
    title: '개인정보 수집 및 이용 동의서',
    version: 3,
    isRequired: true,
    content: '약관 본문',
  },
  {
    termId: 2,
    termCode: 'GIFT_HISTORY_DATA_USE',
    title: '선물 송수신 이력 정보 수집 및 이용 동의서',
    version: 3,
    isRequired: true,
    content: '약관 본문',
  },
  {
    termId: 3,
    termCode: 'MARKETING',
    title: '마케팅 정보 수신 동의서',
    version: 1,
    isRequired: false,
    content: '약관 본문',
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-out');
    window.localStorage.removeItem('accessToken');
  });
});

test('약관 버전 충돌 시 가입하지 않고 서버 안내를 표시한다', async ({ page }) => {
  let submittedBody: unknown;
  let loginRequested = false;
  const authenticatedRequests: string[] = [];
  await page.route(/\/(users\/me|notifications)(\/|\?|$)/, async (route) => {
    authenticatedRequests.push(route.request().url());
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAUTHORIZED' } }),
    });
  });

  await page.route('**/auth/email-availability', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '사용할 수 있는 이메일입니다.',
        data: { available: true },
      }),
    });
  });
  await page.route('**/auth/terms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '회원가입 약관을 조회했습니다.',
        data: { terms: signupTerms },
      }),
    });
  });
  await page.route('**/auth/signup', async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '약관이 변경되었습니다. 다시 확인해 주세요.',
        error: {
          code: 'INVALID_TERM_VERSION',
          traceId: '01JXYZ8D7G5K2M4N6P8Q',
        },
      }),
    });
  });
  await page.route('**/auth/login', async (route) => {
    loginRequested = true;
    await route.abort();
  });

  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이름').fill('테스트');
  await page.getByRole('button', { name: '생년월일 선택' }).click();
  await page.getByLabel('출생 연도').selectOption('1995');
  await page.getByLabel('출생 월').selectOption('5');
  await page.getByLabel('출생 일').selectOption('17');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByLabel('이메일').fill('stale-terms@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();
  await expect(page.getByRole('button', { name: '확인 완료' })).toBeVisible();
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

  await expect(page.getByRole('alert')).toHaveText('약관이 변경되었습니다. 다시 확인해 주세요.');
  await expect(page.getByRole('heading', { name: '약관 동의' })).toBeVisible();
  await expect(page.getByRole('button', { name: '동의하고 회원가입' })).toBeEnabled();
  expect(submittedBody).toMatchObject({
    email: 'stale-terms@gift.local',
    termConsents: [
      { termId: 1, version: 3, isAgreed: true },
      { termId: 2, version: 3, isAgreed: true },
      { termId: 3, version: 1, isAgreed: false },
    ],
  });
  expect(loginRequested).toBe(false);
  expect(authenticatedRequests).toEqual([]);
});
