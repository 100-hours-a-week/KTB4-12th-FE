import { expect, test } from '@playwright/test';

import { isValidSignupBirthday, latestSignupBirthday } from '../src/pages/signup/validation';

test('가입 연령은 생일 당일부터 허용하며 잘못된 날짜를 거부한다', () => {
  const today = new Date(2026, 9, 21);
  expect(isValidSignupBirthday('2012.10.21', today)).toBe(true);
  expect(isValidSignupBirthday('2012.10.20', today)).toBe(true);
  expect(isValidSignupBirthday('2012.10.22', today)).toBe(false);
  expect(isValidSignupBirthday('2012.12.31', today)).toBe(false);
  for (const value of ['', '2012.02.30', '2011.02.29', '2012.13.01', 'bad']) {
    expect(isValidSignupBirthday(value, today)).toBe(false);
  }
});

test('윤년과 연초 경계는 날짜 기준으로 계산한다', () => {
  expect(latestSignupBirthday(new Date(2024, 1, 29))).toBe('2010.02.28');
  expect(isValidSignupBirthday('2010.03.01', new Date(2024, 1, 29))).toBe(false);
  expect(isValidSignupBirthday('2012.02.29', new Date(2026, 1, 28))).toBe(false);
  expect(isValidSignupBirthday('2012.02.29', new Date(2026, 2, 1))).toBe(true);
  expect(latestSignupBirthday(new Date(2026, 0, 1))).toBe('2012.01.01');
});

test('생년월일 선택에서 만 14세 미만을 차단하고 경계일은 허용한다', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12));
  await page.addInitScript(() => {
    localStorage.setItem('prototype-auth', 'signed-out');
    localStorage.removeItem('accessToken');
  });
  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByRole('button', { name: '생년월일 선택' }).click();
  await page.getByLabel('출생 월').selectOption('12');
  await page.getByLabel('출생 일').selectOption('31');
  await page.getByLabel('출생 연도').selectOption('2012');
  await expect(page.getByText('만 14세 이상만 가입할 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '선택 완료' })).toBeDisabled();
  await expect(page.getByLabel('출생 월').locator('option[value="12"]')).toHaveJSProperty(
    'disabled',
    true,
  );
  await page.getByLabel('출생 월').selectOption('10');
  await expect(page.getByLabel('출생 일').locator('option[value="22"]')).toHaveJSProperty(
    'disabled',
    true,
  );
  await page.getByLabel('출생 일').selectOption('21');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(page.getByRole('button', { name: '생년월일 선택' })).toHaveText('2012.10.21');
  await page.getByLabel('이름').fill('테스트');
  await page.getByLabel('이메일').fill('birthday@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();
  await page.getByRole('button', { name: '인증번호 발송' }).click();
  await page.getByLabel('이메일 인증번호').fill('123456');
  await page.getByRole('button', { name: '인증 확인' }).click();
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeEnabled();
  // A stale draft must also be blocked by the form, not just the picker.
  await page.clock.setFixedTime(new Date(2026, 9, 20, 12));
  await page.getByLabel('이름').fill('검증');
  await expect(page.locator('#signup-birthday-error')).toHaveText(
    '만 14세 이상만 가입할 수 있습니다.',
  );
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
});
