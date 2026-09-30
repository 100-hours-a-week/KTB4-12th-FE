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

test('기존 사용자가 이메일로 사용자를 찾아 친구로 추가한다', async ({ page }) => {
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();

  await expect(page.getByRole('heading', { name: '친구 추가' })).toBeVisible();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await page.getByLabel('친구 이메일 검색').fill('kakaa@kakao.co.kr');
  await page.getByRole('button', { name: '검색', exact: true }).click();

  await expect(page.locator('.friend-result')).toHaveCount(1);
  await expect(page.getByText('kakaa@kakao.co.kr')).toBeVisible();

  await page.getByRole('button', { name: '김민정 추가', exact: true }).click();
  await expect(page.getByRole('button', { name: '김민정 추가됨', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '친구 추가 닫기' }).click();
  await expect(page.getByRole('heading', { name: '친구 추가' })).toBeHidden();
  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
});

test('친구 검색은 빈값이나 공백만 입력하면 실행할 수 없다', async ({ page }) => {
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.getByRole('button', { name: '친구 이메일 검색' }).click();

  const searchInput = page.getByLabel('친구 이메일 검색');
  const searchButton = page.getByRole('button', { name: '검색', exact: true });

  await expect(searchButton).toBeDisabled();
  await searchInput.fill('   ');
  await expect(searchButton).toBeDisabled();

  await searchInput.fill('ㄱ');
  await expect(searchButton).toBeEnabled();
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
  await expect(page.getByRole('button', { name: '홍길동 추가', exact: true })).toHaveCount(0);
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
  await page.getByRole('button', { name: '김민정 추가', exact: true }).click();

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
