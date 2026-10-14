import { expect, test } from '@playwright/test';

test('실제 GET의 isSelected로 저장된 비선호 선택을 재진입·새로고침 후 복원한다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem(
      'authUser',
      JSON.stringify({ userId: 1, name: '나', email: 'me@gift.local' }),
    );
    localStorage.setItem('gift-prototype-main-tab', 'mypage');
  });
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 1,
          name: '나',
          email: 'me@gift.local',
          birth: '2000-01-01',
          isBirthdayPublic: false,
          giftSummary: { sentCount: 0, receivedCount: 0 },
        },
      },
    }),
  );
  await page.route(/\/notifications(?:\/.*|\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          unreadCount: 0,
          notifications: [],
          pagination: { nextCursor: null, hasNext: false },
        },
      },
    }),
  );
  let saved = [2],
    puts = 0;
  await page.route('**/preferences/dislike-categories', (route) => {
    if (route.request().method() === 'PUT') {
      puts++;
      saved = route.request().postDataJSON().categoryIds;
      return route.fulfill({ json: { data: { selectedCategoryIds: saved } } });
    }
    return route.fulfill({
      json: {
        data: {
          maxSelectableCount: 5,
          categories: [
            { categoryId: 1, name: '향수', isSelected: saved.includes(1) },
            { categoryId: 2, name: '식품', isSelected: saved.includes(2) },
          ],
        },
      },
    });
  });
  await page.goto('/');
  const open = async () => {
    await page.getByRole('button', { name: '비선호 카테고리 설정' }).click();
    await expect(page.getByRole('button', { name: '식품', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: '향수', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByRole('button', { name: '저장하기', exact: true })).toBeDisabled();
  };
  await open();
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await open();
  await page.reload();
  await expect(page.getByRole('button', { name: '식품', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(puts).toBe(0);
  await page.getByRole('button', { name: '향수', exact: true }).click();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '마이페이지', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '비선호 카테고리 설정' }).click();
  await expect(page.getByRole('button', { name: '향수', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '식품', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '전체 초기화' }).click();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await page.getByRole('button', { name: '비선호 카테고리 설정' }).click();
  await expect(page.getByRole('button', { name: '식품', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: '향수', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: '저장하기', exact: true })).toBeDisabled();
  expect(puts).toBe(2);
});
