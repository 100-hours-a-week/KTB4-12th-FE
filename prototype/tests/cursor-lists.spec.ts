import { expect, type Locator, type Page, test } from '@playwright/test';

async function loadAllPages(page: Page, cards: Locator, expectedCounts: number[]) {
  const scroll = page.getByTestId('mobile-scroll');
  for (const count of expectedCounts) {
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(cards).toHaveCount(count);
  }
}

test('상품 목록을 커서 단위로 이어 붙인다', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  const cards = page.locator('.product-card');
  await expect(cards).toHaveCount(20);
  await loadAllPages(page, cards, [40, 44]);
  await expect(page.getByText('목록의 끝이에요')).toBeVisible();
});

test('받은 선물 목록을 다음 커서까지 불러온다', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await page.getByRole('button', { name: '받은 선물 8건' }).click();
  const cards = page.locator('.received-card');
  await expect(cards).toHaveCount(20);
  await loadAllPages(page, cards, [40, 43]);
  await expect(page.getByText('목록의 끝이에요')).toBeVisible();
});

test('하단 탭은 모바일 화면의 하단 안전 영역 위에 고정된다', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '하단 메뉴' });
  await expect(nav).toBeVisible();
  const geometry = await page.evaluate(() => {
    const screen = document
      .querySelector<HTMLElement>('[data-testid="device-screen"]')!
      .getBoundingClientRect();
    const bottomNav = document.querySelector<HTMLElement>('.bottom-nav')!.getBoundingClientRect();
    return {
      screenTop: screen.top,
      screenBottom: screen.bottom,
      navTop: bottomNav.top,
      navBottom: bottomNav.bottom,
    };
  });
  expect(geometry.navTop).toBeGreaterThan(geometry.screenBottom - 130);
  expect(geometry.navBottom).toBeLessThanOrEqual(geometry.screenBottom);
  expect(geometry.navTop).toBeGreaterThan(geometry.screenTop);
});

test('친구 추가 시 검색을 누르기 전에는 키보드를 열지 않고 화면 전환은 상단에서 시작한다', async ({
  page,
}) => {
  await page.goto('/');
  const keyboard = page.getByTestId('keyboard-dock');
  await page.getByRole('button', { name: '친구 추가', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(keyboard).toHaveAttribute('data-visible', 'false');
  await expect(keyboard).toBeHidden();
  const sheetPosition = await page.evaluate(() => {
    const screen = document
      .querySelector<HTMLElement>('[data-testid="device-screen"]')!
      .getBoundingClientRect();
    const viewportElement = document.querySelector<HTMLElement>(
      '[data-testid="mobile-app-viewport"]',
    )!;
    const viewport = viewportElement.getBoundingClientRect();
    const sheetElement = document.querySelector<HTMLElement>('[data-testid="bottom-sheet"]')!;
    const sheet = sheetElement.getBoundingClientRect();
    return {
      screenBottom: screen.bottom,
      viewportBottom: viewport.bottom,
      viewportTop: viewport.top,
      viewportHeight: viewport.height,
      viewportBottomStyle: getComputedStyle(viewportElement).bottom,
      viewportTransform: getComputedStyle(viewportElement).transform,
      platform: viewportElement.dataset.platform,
      keyboardVisible: viewportElement.dataset.keyboardVisible,
      sheetBottom: sheet.bottom,
      bottom: getComputedStyle(sheetElement).bottom,
      transform: getComputedStyle(sheetElement).transform,
      offsetParent: (sheetElement.offsetParent as HTMLElement | null)?.className,
      matched: document.querySelectorAll(
        '.device-screen:has(.keyboard-dock[data-visible="false"]) .bottom-sheet',
      ).length,
    };
  });
  expect(
    Math.abs(sheetPosition.screenBottom - sheetPosition.sheetBottom),
    JSON.stringify(sheetPosition),
  ).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: '친구 이메일 검색' }).click();
  await expect(keyboard).toHaveAttribute('data-visible', 'true');
  await expect(keyboard).toBeVisible();
  await page.getByRole('button', { name: '친구 추가 닫기' }).click();
  await expect(keyboard).toHaveAttribute('data-visible', 'false');

  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  await expect(page.getByRole('heading', { name: '선물 탐색' })).toBeVisible();
  await expect
    .poll(() => page.getByTestId('mobile-scroll').evaluate((element) => element.scrollTop))
    .toBe(0);
});

test('모든 바텀시트는 배경 화면을 이동시키지 않는다', async ({ page }) => {
  const backgroundPosition = () =>
    page.evaluate(() => {
      const body = document.querySelector<HTMLElement>('.screen-body')!.getBoundingClientRect();
      const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]')!;
      return { top: body.top, screenScrollTop: screen.scrollTop };
    });
  const expectStableAfter = async (openSheet: () => Promise<void>) => {
    const before = await backgroundPosition();
    await openSheet();
    await expect(page.getByTestId('bottom-sheet')).toBeVisible();
    const after = await backgroundPosition();
    expect(after.top).toBeCloseTo(before.top, 3);
    expect(after.screenScrollTop).toBe(before.screenScrollTop);
    await expect(page.getByTestId('bottom-sheet')).toBeFocused();
  };

  await page.goto('/');
  await expectStableAfter(() => page.getByRole('button', { name: '친구 추가' }).click());
  await page.getByRole('button', { name: '친구 추가 닫기' }).click();

  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  await expectStableAfter(() => page.getByRole('button', { name: '필터' }).click());
  await page.getByRole('button', { name: '카테고리 필터 닫기' }).click();

  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await expectStableAfter(() => page.getByRole('button', { name: /생년월일/ }).click());
  await page.getByRole('button', { name: '취소' }).click();
});
