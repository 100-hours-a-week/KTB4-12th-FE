import { expect, test } from '@playwright/test';

const unorderedTerms = [
  {
    termId: 1,
    termCode: 'MARKETING',
    title: '마케팅 정보 수신 동의서',
    version: 1,
    isRequired: false,
    content: '선택 약관 본문',
  },
  {
    termId: 2,
    termCode: 'PRIVACY_COLLECTION_USE',
    title: '개인정보 수집 및 이용 동의서',
    version: 3,
    isRequired: true,
    content: '필수 약관 본문',
  },
  {
    termId: 3,
    termCode: 'GIFT_HISTORY',
    title: '선물 송수신 이력 정보 수집 및 이용 동의서',
    version: 1,
    isRequired: true,
    content: '필수 약관 본문',
  },
];

test('선택 약관을 모든 필수 약관 뒤에 표시한다', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-out');
    window.localStorage.removeItem('accessToken');
  });
  await page.route('**/auth/terms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '회원가입 약관을 조회했습니다.',
        data: { terms: unorderedTerms },
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이름').fill('테스트');
  await page.getByRole('button', { name: '생년월일 선택' }).click();
  await page.getByLabel('출생 연도').selectOption('1995');
  await page.getByLabel('출생 월').selectOption('5');
  await page.getByLabel('출생 일').selectOption('17');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByLabel('이메일').fill('terms-order@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
  await page.getByRole('button', { name: '다음', exact: true }).click();

  await expect(page.locator('.terms-list .terms-label')).toHaveText([
    '(필수) 개인정보 수집 및 이용 동의서',
    '(필수) 선물 송수신 이력 정보 수집 및 이용 동의서',
    '(선택) 마케팅 정보 수신 동의서',
  ]);
});
