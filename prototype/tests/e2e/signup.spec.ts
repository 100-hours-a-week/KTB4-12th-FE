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
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-out');
    window.localStorage.removeItem('accessToken');
  });
  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
});

test('필수 약관만 동의한 신규 사용자가 회원가입을 완료한다', async ({ page }) => {
  await fillSignupForm(page);

  const nextButton = page.getByRole('button', { name: '다음', exact: true });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(page.getByRole('heading', { name: '약관 동의' })).toBeVisible();
  await expect(page.getByRole('button', { name: '동의하고 회원가입' })).toBeDisabled();
  await expect(
    page.getByRole('checkbox', { name: '(선택) 마케팅 정보 수신 동의서', exact: true }),
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

  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'friends');
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
    page.getByRole('checkbox', { name: '(선택) 마케팅 정보 수신 동의서', exact: true }),
  ).toBeChecked();
});
