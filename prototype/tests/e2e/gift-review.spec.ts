import { expect, type Page, test } from '@playwright/test';

const empty = {
  status: 404,
  json: { message: '작성된 리뷰가 없습니다.', error: { code: 'REVIEW_NOT_FOUND' } },
};
const initialReview = {
  reviewId: 1,
  giftId: 410,
  rating: 4,
  content: '실용적이라 마음에 들어요.',
  createdAt: '2026-10-11T00:00:00Z',
  updatedAt: '2026-10-11T00:00:00Z',
};
async function openReview(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('accessToken', 'review-test-token');
  });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
  await page.getByRole('button', { name: /받은 선물/ }).click();
  await page.locator('.gift-history-card').first().click();
  await expect(page.getByRole('heading', { name: '받은 선물 상세' })).toBeVisible();
  await expect(page.locator('.gift-detail-card')).toContainText('수량');
  await expect(page.locator('.gift-detail-card')).not.toContainText('단일 가격');
  await expect(page.locator('.gift-detail-card')).not.toContainText('총 가격');
  await page.locator('.gift-review-section').scrollIntoViewIfNeeded();
}

test('미작성 리뷰는 정상 폼이며 작성·수정 취소·수정·삭제 흐름을 유지한다', async ({ page }) => {
  let saved: typeof initialReview | null = null;
  const methods: string[] = [];
  await page.route('**/gifts/410/review', async (route) => {
    const method = route.request().method();
    methods.push(method);
    if (method === 'GET')
      return saved ? route.fulfill({ json: { data: { review: saved } } }) : route.fulfill(empty);
    if (method === 'DELETE') {
      saved = null;
      return route.fulfill({ json: { data: { giftId: 410, reviewStatus: 'NOT_WRITTEN' } } });
    }
    saved = { ...initialReview, ...route.request().postDataJSON() };
    return route.fulfill({
      status: method === 'POST' ? 201 : 200,
      json: { data: { review: saved } },
    });
  });
  await openReview(page);
  const section = page.locator('.gift-review-section');
  await expect(section.getByRole('alert')).toHaveCount(0);
  await expect(section.getByRole('button', { name: '리뷰 작성' })).toBeDisabled();
  await section.getByRole('button', { name: '4점', exact: true }).click();
  await expect(section.getByText('좋아요', { exact: true })).toBeVisible();
  await section.getByLabel('후기').fill(initialReview.content);
  await section.getByRole('button', { name: '리뷰 작성' }).click();
  await expect(section.getByRole('status')).toHaveText('리뷰를 저장했어요.');
  await expect(section.locator('.gift-review-readonly')).toContainText(initialReview.content);
  await page.screenshot({ path: test.info().outputPath('review-saved.png') });
  await section.getByRole('button', { name: '수정', exact: true }).click();
  await section.getByLabel('후기').fill('취소할 수정');
  await section.getByRole('button', { name: '취소', exact: true }).click();
  await expect(section.locator('.gift-review-readonly')).toContainText(initialReview.content);
  await section.getByRole('button', { name: '수정', exact: true }).click();
  await expect(section.getByLabel('후기')).toHaveValue(initialReview.content);
  await section.getByRole('button', { name: '5점', exact: true }).click();
  await section.getByLabel('후기').fill('매일 잘 쓰고 있어요!');
  await section.getByRole('button', { name: '리뷰 수정', exact: true }).click();
  await expect(section.locator('.gift-review-stars')).toHaveAttribute('aria-label', '5점');
  await section.getByRole('button', { name: '삭제', exact: true }).click();
  await page
    .getByRole('dialog', { name: '리뷰를 삭제할까요?' })
    .getByRole('button', { name: '삭제', exact: true })
    .click();
  await expect(section.getByRole('button', { name: '리뷰 작성' })).toBeDisabled();
  await expect(section.getByLabel('후기')).toHaveValue('');
  expect(methods.filter((method) => method !== 'GET')).toEqual(['POST', 'PATCH', 'DELETE']);
  expect(methods).toContain('GET');
});

test('조회 실패는 재시도하고 저장 실패는 입력을 유지한다', async ({ page }) => {
  let recovered = false;
  await page.route('**/gifts/410/review', async (route) => {
    if (route.request().method() === 'GET' && recovered) return route.fulfill(empty);
    return route.fulfill({
      status: 500,
      json: { message: '잠시 후 다시 시도해 주세요.', error: { code: 'INTERNAL_SERVER_ERROR' } },
    });
  });
  await openReview(page);
  const section = page.locator('.gift-review-section');
  await expect(section.getByRole('alert')).toBeVisible();
  await expect(section.getByLabel('후기')).toHaveCount(0);
  recovered = true;
  await section.getByRole('button', { name: '다시 시도' }).click();
  await section.getByRole('button', { name: '3점', exact: true }).click();
  await section.getByLabel('후기').fill('다시 저장할 후기');
  await section.getByRole('button', { name: '리뷰 작성' }).click();
  await expect(section.getByRole('alert')).toHaveText('잠시 후 다시 시도해 주세요.');
  await expect(section.getByLabel('후기')).toHaveValue('다시 저장할 후기');
  await expect(section.getByRole('button', { name: '리뷰 작성' })).toBeEnabled();
});

test('선물 없음 404는 리뷰 미작성으로 처리하지 않는다', async ({ page }) => {
  await page.route('**/gifts/410/review', (route) =>
    route.fulfill({
      status: 404,
      json: { message: '받은 선물을 찾을 수 없습니다.', error: { code: 'GIFT_NOT_FOUND' } },
    }),
  );
  await openReview(page);
  await expect(page.locator('.gift-review-section').getByRole('alert')).toHaveText(
    '받은 선물을 찾을 수 없습니다.',
  );
  await expect(page.getByRole('button', { name: '리뷰 작성' })).toHaveCount(0);
});

test('320px에서도 별점 터치 영역과 작성 카드가 화면 안에 들어간다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route('**/gifts/410/review', (route) => route.fulfill(empty));
  await openReview(page);
  const section = page.locator('.gift-review-section');
  await expect(section.getByRole('button', { name: '리뷰 작성' })).toBeVisible();
  const stars = await section.getByRole('group', { name: '별점 선택' }).getByRole('button').all();
  for (const star of stars) {
    const box = await star.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: test.info().outputPath('review-empty-mobile.png') });
});
