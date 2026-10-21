import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
    window.localStorage.setItem(
      'authUser',
      JSON.stringify({ userId: 1, name: '홍길동', email: 'email@email.com' }),
    );
  });
  await page.goto('/');
});

test('기존 사용자가 친구 목록에서 이름으로 친구를 검색한다', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
  await expect(page.locator('.friend-card')).toHaveCount(20);

  await page.getByLabel('친구 이름 검색').click();
  await page.getByLabel('친구 이름 검색').fill('김민지');

  const searchResults = page.locator('.friend-card');
  await expect(searchResults).toHaveCount(5);
  await expect(searchResults).toContainText([
    '김민지',
    '김민지 2',
    '김민지 3',
    '김민지 4',
    '김민지 5',
  ]);
  await expect(page.getByText('목록의 끝이에요')).toBeVisible();
});

test('친구 목록은 공백만 입력해도 검색 상태로 전환하지 않는다', async ({ page }) => {
  await expect(page.locator('.friend-card')).toHaveCount(20);

  const searchInput = page.getByLabel('친구 이름 검색');
  await searchInput.click();
  await searchInput.fill('   ');

  await expect(page.locator('.friend-card')).toHaveCount(20);
  await expect(page.getByText('검색 결과가 없어요')).toHaveCount(0);
});

test('기존 사용자가 이메일로 사용자를 찾아 친구 요청을 보낸다', async ({ page }) => {
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();

  await expect(page.getByRole('heading', { name: '친구 추가' })).toBeVisible();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await page.getByLabel('친구 이메일 검색').fill('kakaa@kakao.co.kr');
  await page.getByRole('button', { name: '검색', exact: true }).click();

  await expect(page.locator('.friend-result')).toHaveCount(1);
  await expect(page.getByText('kakaa@kakao.co.kr')).toBeVisible();

  await page.getByRole('button', { name: '김민정 친구 요청', exact: true }).click();
  await expect(page.getByRole('button', { name: '김민정 요청 보냄', exact: true })).toBeDisabled();
  await expect(page.locator('.app-toast')).toHaveText('친구 요청을 보냈습니다.');

  await page.getByRole('button', { name: '친구 추가 닫기' }).click();
  await expect(page.getByRole('heading', { name: '친구 추가' })).toBeHidden();
  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
  await page.getByRole('tab', { name: '보낸 요청' }).click();
  await expect(page.locator('.friend-card')).toHaveCount(1);
  await expect(page.locator('.friend-card')).toContainText('김민정');
  await expect(page.getByRole('button', { name: '요청 취소', exact: true })).toBeVisible();
});

test('친구 검색은 빈값이나 공백만 입력하면 실행할 수 없다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const entry = page.getByRole('button', { name: '친구 추가', exact: true });
  await expect(entry).toBeEnabled();
  await expect(page.locator('.friend-card')).toHaveCount(20);
  expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: '/tmp/friend-buttons-entry.png' });
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();

  const searchInput = page.getByLabel('친구 이메일 검색');
  const searchButton = page.getByRole('button', { name: '검색', exact: true });

  await expect(searchButton).toBeDisabled();
  const searchSurface = searchButton.locator('span');
  const disabledBackground = await searchSurface.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect((await searchButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await searchInput.fill('   ');
  await expect(searchButton).toBeDisabled();

  await searchInput.fill('ㄱ');
  await expect(searchButton).toBeEnabled();
  expect(await searchSurface.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    disabledBackground,
  );
  await searchInput.fill('kakaa@kakao.co.kr');
  await searchButton.click();
  await expect(page.getByRole('button', { name: '김민정 친구 요청' })).toBeVisible();
  await expect(searchSurface).toHaveCSS('background-color', 'rgb(184, 62, 74)');
  await expect(searchSurface).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: '/tmp/friend-buttons-result.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('친구 추가 닫기 버튼과 검색 영역 사이에 충분한 간격을 둔다', async ({ page }) => {
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.waitForTimeout(500);

  const closeBox = await page.getByRole('button', { name: '친구 추가 닫기' }).boundingBox();
  const searchBox = await page.locator('.friend-search-row').boundingBox();

  expect(closeBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(searchBox!.y - (closeBox!.y + closeBox!.height)).toBeGreaterThanOrEqual(20);
});

test('친구 검색 결과가 나 자신이면 추가 버튼을 표시하지 않는다', async ({ page }) => {
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await page.getByLabel('친구 이메일 검색').fill('email@email.com');
  await page.getByRole('button', { name: '검색', exact: true }).click();

  await expect(page.getByText('email@email.com')).toBeVisible();
  await expect(page.getByRole('button', { name: '홍길동 친구 요청', exact: true })).toHaveCount(0);
});

test('친구 검색 API 오류를 토스트로 표시한다', async ({ page }) => {
  await page.goto('/?qa=friend-search-error');
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await page.getByLabel('친구 이메일 검색').fill('kakaa@kakao.co.kr');
  await page.getByRole('button', { name: '검색', exact: true }).click();

  await expect(page.locator('.app-toast')).toHaveText('친구 검색에 실패했습니다.');
  await expect(page.locator('.friend-results [role="alert"]')).toHaveCount(0);
});

test('친구 추가 API 오류를 토스트로 표시한다', async ({ page }) => {
  await page.goto('/?qa=friend-add-error');
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await page.getByLabel('친구 이메일 검색').fill('kakaa@kakao.co.kr');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('button', { name: '김민정 친구 요청', exact: true }).click();

  await expect(page.locator('.app-toast')).toHaveText('친구 추가에 실패했습니다.');
  await expect(page.locator('.friend-results [role="alert"]')).toHaveCount(0);
});

test('친구 검색 결과가 없으면 빈 상태를 표시한다', async ({ page }) => {
  await page.getByLabel('친구 이름 검색').click();
  await page.getByLabel('친구 이름 검색').fill('존재하지 않는 친구');

  await expect(page.locator('.friend-card')).toHaveCount(0);
  await expect(page.getByText('검색 결과가 없어요')).toBeVisible();
});

test('친구 목록 조회 실패 후 다시 시도하면 목록을 표시한다', async ({ page }) => {
  await page.goto('/?qa=friend-list-error');

  const errorMessage = page.getByText('친구 목록 조회에 실패했습니다. 다시 시도해 주세요.');
  await expect(errorMessage).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();

  await page.getByRole('button', { name: '다시 시도' }).click();

  await expect(errorMessage).toBeHidden();
  await expect(page.locator('.friend-card')).toHaveCount(20);
});

test('목업 받은 요청을 수락하면 친구 목록에서 선물할 수 있다', async ({ page }) => {
  await page.goto('/?qa=friend-requests');
  await page.getByRole('tab', { name: '받은 요청' }).click();
  await page.getByRole('button', { name: '수락', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '친구 요청 수락' });
  await dialog.getByRole('button', { name: '수락', exact: true }).click();
  await expect(page.getByText('받은 친구 요청이 없어요')).toBeVisible();
  await page.getByRole('tab', { name: '친구 목록', exact: true }).click();
  const friend = page.locator('.friend-card').filter({ hasText: '이서진' });
  await expect(friend.getByRole('button', { name: '선물하기' })).toBeVisible();
});
