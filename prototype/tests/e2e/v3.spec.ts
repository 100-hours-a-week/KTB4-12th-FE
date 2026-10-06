import { expect, type Page, test } from '@playwright/test';

async function openMyPage(page: Page) {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (window.location.search.includes('qa=first-login')) {
      window.localStorage.setItem('prototype-auth', 'signed-out');
    } else {
      window.localStorage.setItem('prototype-auth', 'signed-in');
      window.localStorage.setItem('accessToken', 'prototype-test-token');
    }
  });
  await page.goto('/');
});

test('마이페이지에서 보낸 선물 상세로 이동한다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: /보낸 선물/ }).click();
  await expect(page.getByRole('heading', { name: '보낸 선물' })).toBeVisible();
  const card = page.locator('.gift-history-card').first();
  await expect(card).toContainText('to.');
  await card.click();
  await expect(page.getByRole('heading', { name: '보낸 선물 상세' })).toBeVisible();
  await expect(page.locator('.gift-detail-card')).toContainText('총 가격');
});

test('비선호 카테고리는 저장값 대비 변경과 전체 초기화를 판정한다', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('mock-dislike-categories', '[1,2]'));
  await page.reload();
  await openMyPage(page);
  await page.getByRole('button', { name: /비선호 카테고리/ }).click();

  const save = page.getByRole('button', { name: '저장하기' });
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: '전체 초기화' }).click();
  await expect(save).toBeEnabled();
  await page.getByRole('button', { name: '뷰티' }).click();
  await page.getByRole('button', { name: '패션' }).click();
  await expect(save).toBeDisabled();
});

test('내 선물 취향은 500자 제한과 미저장 이탈 확인을 제공한다', async ({ page }) => {
  await openMyPage(page);
  await page.getByRole('button', { name: /내 선물 취향/ }).click();
  const input = page.getByPlaceholder('좋아하는 스타일, 색상, 필요한 물건을 자유롭게 적어주세요.');
  await input.fill('실용적이고 미니멀한 선물을 좋아해요.');
  await expect(page.getByText(/\/500$/)).toBeVisible();
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await expect(
    page.getByRole('dialog', { name: '변경사항을 저장하지 않고 나갈까요?' }),
  ).toBeVisible();
});

test('상품 상세의 AI 버튼은 입력을 유지하고 준비 중 토스트를 표시한다', async ({ page }) => {
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  await page.locator('.product-card').first().click();
  await page.getByRole('button', { name: 'AI 선물 추천 열기' }).click();

  const input = page.getByPlaceholder('메시지를 입력하세요...');
  await input.fill('직장 동료에게 줄 실용적인 승진 선물을 추천해줘');
  await expect(page.locator('.ai-composer > span')).toHaveText(/\/100$/);
  await page.getByRole('button', { name: '메시지 전송' }).click();
  await expect(page.getByRole('status')).toHaveText('AI 추천 기능은 준비 중이에요.');
});

test('알림을 읽고 받은 선물 상세로 이동한다', async ({ page }) => {
  await page.getByRole('button', { name: /알림 1개/ }).click();
  const sheet = page.getByRole('dialog', { name: '알림' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /김민지님이 선물을 보냈어요/ }).click();
  await expect(page.getByRole('heading', { name: '받은 선물 상세' })).toBeVisible();
});

test('최초 로그인에서는 공통 비선호 카테고리 선택 시트를 표시한다', async ({ page }) => {
  await page.goto('/?qa=first-login');
  await page.getByLabel('이메일').fill('test@gift.local');
  await page.getByLabel('비밀번호').fill('Test1234!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  const sheet = page.getByRole('dialog', { name: '비선호 카테고리 설정' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '뷰티' }).click();
  await expect(sheet.getByRole('button', { name: '저장하기' })).toBeEnabled();
});

test('AI 프로파일 상태는 QA 쿼리에서만 표시된다', async ({ page }) => {
  await page.goto('/?qa=ai-profile-completed');
  await expect(page.locator('.ai-profile-panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();
});
