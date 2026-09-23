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

test('사용자가 비선호 카테고리를 변경하고 저장한다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: '비선호 카테고리 설정' }).click();

  await expect(page.getByRole('heading', { name: '비선호 카테고리' })).toBeVisible();
  await expect(page.getByRole('button', { name: '패션' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '패션' }).click();
  await expect(page.getByRole('button', { name: '패션' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '저장하기' }).click();
  await expect(page.getByRole('button', { name: '저장했어요' })).toBeVisible();
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

  await expect(page.getByRole('button', { name: /보낸 선물/ })).toHaveCount(0);
  await page.getByRole('button', { name: '받은 선물 8건' }).click();
  await expect(page.getByRole('heading', { name: '받은 선물' })).toBeVisible();
  await expect(page.locator('article.received-card').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /선물 상세/ })).toHaveCount(0);
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
