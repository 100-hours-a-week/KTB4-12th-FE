import { expect, type Page, test } from '@playwright/test';

async function fillSignupForm(page: Page) {
  await page.getByLabel('이름').fill('테스트');
  await page.getByRole('button', { name: '생년월일 선택' }).click();
  await expect(page.getByRole('heading', { name: '생년월일 선택' })).toBeVisible();
  await page.getByLabel('출생 연도').selectOption('1995');
  await page.getByLabel('출생 월').selectOption('5');
  await page.getByLabel('출생 일').selectOption('17');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByLabel('이메일').fill('new@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();
  await page.getByRole('button', { name: '인증번호 발송' }).click();
  await page.getByLabel('이메일 인증번호').fill('123456');
  await page.getByRole('button', { name: '인증 확인' }).click();
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
}

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/terms', (route) =>
    route.fulfill({
      json: {
        message: '회원가입 약관을 조회했습니다.',
        data: {
          terms: [
            {
              termId: 1,
              termCode: 'PRIVACY_COLLECTION_USE',
              version: 3,
              isRequired: true,
              title: '개인정보 수집 및 이용 동의서',
              content:
                '개인정보 수집 및 이용 안내\n\n1. 수집하는 개인정보\n이름, 생년월일, 이메일 주소를 수집합니다.',
            },
            {
              termId: 2,
              termCode: 'GIFT_HISTORY',
              version: 1,
              isRequired: true,
              title: '선물 송수신 이력 정보 수집 및 이용 동의서',
              content: '선물 송수신 이력 수집 및 이용 안내',
            },
            {
              termId: 3,
              termCode: 'REVIEW_AI_IMPROVEMENT',
              version: 1,
              isRequired: false,
              title: '리뷰·별점 AI 개선 동의',
              content: '선택 리뷰·별점 AI 개선 활용 안내',
            },
          ],
        },
      },
    }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-out');
    window.localStorage.removeItem('accessToken');
  });
  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
});

test('숫자가 포함된 이름은 다음 단계 진행을 차단한다', async ({ page }) => {
  await fillSignupForm(page);
  await page.getByLabel('이름').fill('테스트1');

  await expect(page.getByText('한글 또는 영문으로 1~30자 이내로 입력해 주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
});

test('조합 규칙을 충족하지 않는 비밀번호는 다음 단계 진행을 차단한다', async ({ page }) => {
  await fillSignupForm(page);
  await page.getByLabel('비밀번호', { exact: true }).fill('abcdefgh');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('abcdefgh');

  await expect(
    page.getByText('영문, 숫자, 특수문자(!@#$%^&*()_+-=)를 모두 포함해 8~64자로 입력해 주세요.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
});

test('비밀번호와 비밀번호 확인의 보기 상태를 각각 변경한다', async ({ page }) => {
  const password = page.getByLabel('비밀번호', { exact: true });
  const confirmation = page.getByLabel('비밀번호 확인', { exact: true });

  await page.getByRole('button', { name: '비밀번호 보기', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(confirmation).toHaveAttribute('type', 'password');

  await page.getByRole('button', { name: '비밀번호 확인 보기', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(confirmation).toHaveAttribute('type', 'text');
});

test('이메일 중복 확인만으로는 다음 단계가 열리지 않고 인증 후 열린다', async ({ page }) => {
  const startedAt = new Date(2026, 9, 26, 12);
  await page.clock.setFixedTime(startedAt);
  await page.getByLabel('이름').fill('테스트');
  await page.getByRole('button', { name: '생년월일 선택' }).click();
  await page.getByLabel('출생 연도').selectOption('1995');
  await page.getByLabel('출생 월').selectOption('5');
  await page.getByLabel('출생 일').selectOption('17');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
  await page.getByLabel('이메일').fill('verification@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();

  await expect(page.getByText('사용할 수 있는 이메일입니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '인증번호 발송' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: '인증번호 발송' }).click();
  await expect(page.getByRole('button', { name: /재발송 \d+초/ })).toBeDisabled();
  await expect(page.getByText('재발송까지 60초')).toBeVisible();
  await page.getByLabel('이메일 인증번호').fill('123456');
  await page.getByRole('button', { name: '인증 확인' }).click();

  await expect(page.getByRole('status')).toHaveText('이메일 인증 완료');
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeEnabled();

  await page.clock.setFixedTime(new Date(startedAt.getTime() + 11 * 60_000));
  await expect(page.getByText('인증번호가 만료됐어요. 다시 발송해 주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();

  await page.getByLabel('이메일', { exact: true }).fill('changed@gift.local');
  await expect(page.getByText('사용할 수 있는 이메일입니다.')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
});

test('한 글자 이름도 유효한 회원가입 입력으로 허용한다', async ({ page }) => {
  await fillSignupForm(page);
  await page.getByLabel('이름').fill('김');

  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeEnabled();
});

test('만 14세 미만 응답은 가입 불가 사유를 명확히 안내한다', async ({ page }) => {
  await page.goto('/?qa=signup-underage');
  await page.getByRole('button', { name: '회원가입' }).click();
  await fillSignupForm(page);
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

  await expect(page.getByRole('alert')).toHaveText('만 14세 미만은 서비스를 이용할 수 없습니다.');
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'terms');
});

test('약관 상세는 서버 본문의 문단 구조를 유지하고 닫을 수 있다', async ({ page }) => {
  await fillSignupForm(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();

  await page
    .getByRole('button', {
      name: '(필수) 개인정보 수집 및 이용 동의서 상세 보기',
      exact: true,
    })
    .click();

  const detailSheet = page.getByTestId('bottom-sheet');
  const detailCopy = detailSheet.locator('.terms-detail-copy');
  await expect(
    detailSheet.getByRole('heading', { name: '개인정보 수집 및 이용 동의서' }),
  ).toBeVisible();
  await expect(detailCopy).toContainText('1. 수집하는 개인정보');
  await expect(
    detailSheet.getByRole('heading', { name: '1. 수집하는 개인정보', level: 3 }),
  ).toBeVisible();
  await expect(detailCopy).toHaveCSS('white-space', 'pre-wrap');

  await detailSheet.getByRole('button', { name: '약관 상세 닫기' }).click();
  await expect(detailSheet).not.toBeVisible();
});

test('필수 약관만 동의한 신규 사용자가 회원가입을 완료한다', async ({ page }) => {
  await fillSignupForm(page);

  const nextButton = page.getByRole('button', { name: '다음', exact: true });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(page.getByRole('heading', { name: '약관 동의' })).toBeVisible();
  await expect(page.getByRole('button', { name: '동의하고 회원가입' })).toBeDisabled();
  await expect(
    page.getByRole('checkbox', { name: '(선택) 리뷰·별점 AI 개선 동의', exact: true }),
  ).not.toBeChecked();

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

  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
  await expect(page.getByRole('status')).toHaveText('회원가입이 완료됐어요. 로그인해 주세요.');
});

test('약관 화면에서 돌아오면 작성한 회원정보를 유지한다', async ({ page }) => {
  await fillSignupForm(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '뒤로 가기' }).click();

  await expect(page.getByLabel('이름')).toHaveValue('테스트');
  await expect(page.getByRole('button', { name: '생년월일 선택' })).toContainText('1995.05.17');
  await expect(page.getByLabel('이메일')).toHaveValue('new@gift.local');
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('Test1234!');
});

test('전체 동의는 필수 약관과 선택 약관을 모두 선택한다', async ({ page }) => {
  await fillSignupForm(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('전체 동의').check();

  await expect(
    page.getByRole('checkbox', { name: '(필수) 개인정보 수집 및 이용 동의서', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', {
      name: '(필수) 선물 송수신 이력 정보 수집 및 이용 동의서',
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: '(선택) 리뷰·별점 AI 개선 동의', exact: true }),
  ).toBeChecked();
});
