import { expect, test } from '@playwright/test';

for (const status of [204, 404, 500]) {
  test(`친구 삭제 ${status}: friendId로 호출하고 결과를 반영한다`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'test-token');
    });
    let removed = false;
    let calls = 0;
    await page.route(/\/friends(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          data: {
            friends: removed
              ? []
              : [
                  {
                    friendId: 31,
                    userId: 27,
                    name: '김민정',
                    email: 'friend@example.com',
                    birth: null,
                  },
                ],
            pagination: { nextCursor: null, hasNext: false },
          },
        },
      }),
    );
    await page.route('**/friends/31', (route) => {
      calls++;
      expect(route.request().method()).toBe('DELETE');
      expect(route.request().postData()).toBeNull();
      removed = status !== 500;
      if (status === 204) return route.fulfill({ status: 204 });
      return route.fulfill({
        status,
        json: {
          message: status === 404 ? '친구 관계를 찾을 수 없습니다.' : '삭제에 실패했습니다.',
          error: { code: status === 404 ? 'FRIEND_NOT_FOUND' : 'INTERNAL_SERVER_ERROR' },
        },
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '김민정 친구 메뉴', exact: true }).click();
    await page.getByRole('menuitem', { name: '김민정 친구 삭제', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '친구 삭제', exact: true });
    await expect(dialog).toContainText('김민정');
    await dialog.getByRole('button', { name: '돌아가기' }).click();
    expect(calls).toBe(0);
    await expect(page.getByRole('button', { name: '선물하기' })).toBeVisible();
    await page.getByRole('button', { name: '김민정 친구 메뉴', exact: true }).click();
    await page.getByRole('menuitem', { name: '김민정 친구 삭제', exact: true }).click();
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    if (status === 500) {
      await expect(page.locator('.app-toast')).toHaveText('삭제에 실패했습니다.');
      await expect(dialog.getByRole('button', { name: '삭제', exact: true })).toBeEnabled();
      await expect(page.locator('.friend-card')).toHaveCount(1);
    } else {
      await expect(dialog).toBeHidden();
      await expect(page.getByText('등록된 친구가 없어요')).toBeVisible();
      await expect(page.locator('.app-toast')).toHaveText(
        status === 204 ? '친구를 삭제했습니다.' : '친구 관계를 찾을 수 없습니다.',
      );
    }
    expect(calls).toBe(1);
  });
}
