import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
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

test('친구 검색 결과가 없으면 빈 상태를 표시한다', async ({ page }) => {
  await page.getByLabel('친구 이름 검색').click();
  await page.getByLabel('친구 이름 검색').fill('존재하지 않는 친구');

  await expect(page.locator('.friend-card')).toHaveCount(0);
  await expect(page.getByText('검색 결과가 없어요')).toBeVisible();
});
