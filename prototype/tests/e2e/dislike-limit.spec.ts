import { expect, test } from '@playwright/test';

for (const onboarding of [false, true]) {
  test(`${onboarding ? '온보딩' : '마이페이지'}에서 선택 제한 안내 후 해제·재선택·저장할 수 있다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((firstLogin) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('prototype-auth', firstLogin ? 'signed-out' : 'signed-in');
      if (!firstLogin) localStorage.setItem('accessToken', 'prototype-test-token');
    }, onboarding);
    await page.goto(onboarding ? '/?qa=first-login' : '/');
    if (onboarding) {
      await page.getByLabel('이메일').fill('test@gift.local');
      await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
      await page.getByRole('button', { name: '로그인', exact: true }).click();
      await expect(page.getByRole('dialog', { name: '비선호 카테고리 설정' })).toBeVisible();
    } else {
      await page
        .getByRole('navigation', { name: '하단 메뉴' })
        .getByRole('button', { name: '마이' })
        .click();
      await page.getByRole('button', { name: '비선호 카테고리 설정' }).click();
    }
    const rows = page.locator('.category-list .category-row');
    await expect(rows.nth(5)).toBeVisible();
    for (let index = 0; index < 5; index++) await rows.nth(index).click();
    await rows.nth(5).click();
    const notice = page
      .locator('.preference-toolbar')
      .getByRole('status')
      .filter({ hasText: '최대 5개' });
    await expect(notice).toHaveText('최대 5개 · 다른 항목을 선택하려면 먼저 해제해 주세요');
    await expect(notice).toBeVisible();
    const toast = page.locator('.app-toast').filter({ hasText: '비선호 카테고리는 최대 5개' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 4500 });
    await rows.nth(5).click();
    await expect(toast).toBeVisible();
    await expect(rows.filter({ has: page.locator('.select-dot.active') })).toHaveCount(5);
    await expect(rows.nth(5)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: '저장하기', exact: true })).toBeEnabled();
    await rows.nth(0).click();
    await expect(toast).toHaveCount(0);
    await expect(notice).toHaveCount(0);
    await rows.nth(5).click();
    await expect(rows.nth(5)).toHaveAttribute('aria-pressed', 'true');
    await expect(rows.filter({ has: page.locator('.select-dot.active') })).toHaveCount(5);
    if (!onboarding) {
      await rows.nth(0).click();
      await expect(notice).toBeVisible();
      await page.getByRole('button', { name: '전체 해제' }).click();
      await expect(notice).toHaveCount(0);
      await expect(rows.filter({ has: page.locator('.select-dot.active') })).toHaveCount(0);
      await rows.nth(5).click();
    }
    await page.getByRole('button', { name: '저장하기', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('mock-dislike-categories') ?? '[]').length,
        ),
      )
      .toBe(onboarding ? 5 : 1);
  });
}
