import { expect, type Page, test } from '@playwright/test';

async function openMyPage(page: Page) {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible();
  await expect(page.getByText('홍길동', { exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
  });
  await page.goto('/');
});

test('마이페이지 탭으로 새로고침해도 사용자 정보를 조회한다', async ({ page }) => {
  await page.evaluate(() => window.localStorage.setItem('gift-prototype-main-tab', 'mypage'));
  await page.reload();

  await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible();
  await expect(page.getByText('홍길동', { exact: true })).toBeVisible();
  await expect(page.getByText('email@email.com', { exact: true })).toBeVisible();
});

test('내 정보 관리 화면을 새로고침해도 화면과 프로필을 복원한다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await expect(page.getByRole('heading', { name: '내 정보 및 공개 설정' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: '내 정보 및 공개 설정' })).toBeVisible();
  await expect(page.getByRole('button', { name: /생년월일/ })).toBeVisible();
});

test('받은 선물 화면을 새로고침해도 화면을 복원한다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: '받은 선물 8건' }).click();
  await expect(page.getByRole('heading', { name: '받은 선물' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: '받은 선물' })).toBeVisible();
});

test('비선호 카테고리 설정 화면을 새로고침해도 화면을 복원한다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: '비선호 카테고리 설정' }).click();
  await expect(page.getByRole('heading', { name: '비선호 카테고리' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: '비선호 카테고리' })).toBeVisible();
});

test('사용자가 비선호 카테고리를 변경하고 저장한다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: '비선호 카테고리 설정' }).click();

  await expect(page.getByRole('heading', { name: '비선호 카테고리' })).toBeVisible();
  await expect(page.getByRole('button', { name: '패션' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '패션' }).click();
  await expect(page.getByRole('button', { name: '패션' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '저장하기' }).click();
  await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('비선호 카테고리를 저장했습니다.');
});

test('사용자가 생일 공개에 동의하면 공개 상태로 변경된다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: '내 정보 관리' }).click();

  const birthdaySwitch = page.getByRole('switch', { name: /생일 공개/ });
  await expect(birthdaySwitch).toHaveAttribute('aria-checked', 'false');
  await birthdaySwitch.click();

  const consentDialog = page.getByRole('dialog', { name: '생일을 공개할까요?' });
  await expect(consentDialog).toBeVisible();
  await consentDialog.getByRole('button', { name: '동의하고 공개' }).click();
  await expect(birthdaySwitch).toHaveAttribute('aria-checked', 'true');
});

test('사용자가 받은 선물 목록을 조회한다', async ({ page }) => {
  await openMyPage(page);

  await expect(page.getByRole('button', { name: /보낸 선물/ })).toBeVisible();
  await page.getByRole('button', { name: '받은 선물 8건' }).click();
  await expect(page.getByRole('heading', { name: '받은 선물' })).toBeVisible();
  await expect(page.locator('.gift-history-card').first()).toBeVisible();
  await page.locator('.gift-history-card').first().click();
  await expect(page.getByRole('heading', { name: '받은 선물 상세' })).toBeVisible();
});

test('[QA 89, 90, 91] 마이페이지 정보를 확인하고 생년월일을 취소·저장한다', async ({ page }) => {
  await openMyPage(page);
  await expect(page.getByText('email@email.com', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '받은 선물 8건' })).toBeVisible();
  await page.getByRole('button', { name: '내 정보 관리' }).click();

  await page.getByRole('button', { name: /생년월일/ }).click();
  let sheet = page.getByRole('dialog', { name: '생년월일 수정' });
  await sheet.getByLabel('출생 연도').selectOption('1999');
  await sheet.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('button', { name: /2000\.01\.01/ })).toBeVisible();

  await page.getByRole('button', { name: /생년월일/ }).click();
  sheet = page.getByRole('dialog', { name: '생년월일 수정' });
  await sheet.getByLabel('출생 연도').selectOption('1999');
  await sheet.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /1999\.01\.01/ })).toBeVisible();
});

test('[QA 93, 94, 95] 생일 공개 취소·동의·비공개를 검증한다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  const birthdaySwitch = page.getByRole('switch', { name: /생일 공개/ });

  await birthdaySwitch.click();
  let dialog = page.getByRole('dialog', { name: '생일을 공개할까요?' });
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(birthdaySwitch).toHaveAttribute('aria-checked', 'false');

  await birthdaySwitch.click();
  dialog = page.getByRole('dialog', { name: '생일을 공개할까요?' });
  await dialog.getByRole('button', { name: '동의하고 공개' }).click();
  await expect(birthdaySwitch).toHaveAttribute('aria-checked', 'true');

  await birthdaySwitch.click();
  await expect(birthdaySwitch).toHaveAttribute('aria-checked', 'false');
});

test('사용자가 로그아웃하면 로그인 화면으로 이동하고 인증 정보가 삭제된다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await page.getByRole('button', { name: '로그아웃' }).click();

  const logoutDialog = page.getByRole('dialog', { name: '로그아웃하시겠어요?' });
  await logoutDialog.getByRole('button', { name: '로그아웃' }).click();

  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await expect(page.getByTestId('gift-app')).toHaveAttribute('data-route', 'login');
  await expect
    .poll(() =>
      page.evaluate(() => ({
        auth: window.localStorage.getItem('prototype-auth'),
        token: window.localStorage.getItem('accessToken'),
      })),
    )
    .toEqual({ auth: 'signed-out', token: null });
});
