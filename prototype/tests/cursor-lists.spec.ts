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

test('친구 목록 검색 시 커서를 처음부터 다시 시작한다', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '친구' })
    .click();
  const cards = page.locator('.friend-card');
  await expect(cards).toHaveCount(20);
  await loadAllPages(page, cards, [40, 46]);
  await page.getByLabel('친구 이름 검색').click();
  await page.getByLabel('친구 이름 검색').fill('김민지');
  await expect(cards).toHaveCount(5);
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

test('친구 추가 시에도 시뮬레이션 키보드를 열지 않고 화면 전환은 상단에서 시작한다', async ({
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
  const searchInput = page.getByRole('textbox', { name: '친구 이메일 검색' });
  await expect(searchInput).toBeFocused();
  await expect(keyboard).toHaveAttribute('data-visible', 'false');
  await expect(keyboard).toBeHidden();
  await page.keyboard.type('friend1@kakao.co.kr');
  await expect(searchInput).toHaveValue('friend1@kakao.co.kr');
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

test('상품 필터와 마이페이지의 하위 설정 화면을 연다', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '선물' })
    .click();
  await page.getByRole('button', { name: '필터' }).click();
  await expect(page.getByRole('heading', { name: '카테고리 필터' })).toBeVisible();
  await page.getByRole('button', { name: '뷰티' }).click();
  await page.getByRole('button', { name: '적용하기' }).click();
  await expect(page.getByRole('button', { name: '필터, 1개 선택됨' })).toBeVisible();

  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await expect(page.getByRole('heading', { name: '내 정보 및 공개 설정' })).toBeVisible();
  await page.getByRole('button', { name: /생년월일/ }).click();
  await expect(page.getByRole('heading', { name: '생년월일 수정' })).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('switch', { name: /생일 공개/ }).click();
  await expect(page.getByRole('dialog', { name: '생일을 공개할까요?' })).toBeVisible();
  await page.getByRole('button', { name: '동의하고 공개' }).click();
});

test('받은 선물은 v1 범위에서 목록만 제공한다', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await expect(page.getByRole('button', { name: /보낸 선물/ })).toHaveCount(0);
  await page.getByRole('button', { name: '받은 선물 8건' }).click();
  await expect(page.getByRole('heading', { name: '받은 선물' })).toBeVisible();
  await expect(page.locator('article.received-card').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /선물 상세/ })).toHaveCount(0);
});

test('로그아웃 후 테스트 계정으로 다시 로그인한다', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await page.getByRole('button', { name: '로그아웃' }).click();
  const dialog = page.getByRole('dialog', { name: '로그아웃하시겠어요?' });
  await dialog.getByRole('button', { name: '로그아웃' }).click();

  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await page.getByLabel('이메일').fill('test@gift.local');
  await page.getByLabel('비밀번호').fill('Test1234!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
});

test('회원가입 다음 단계에서 Figma 약관과 상세 바텀시트를 제공한다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.setItem('prototype-auth', 'signed-out'));
  await page.reload();
  await page.getByRole('button', { name: '회원가입' }).click();

  await page.getByLabel('이름').fill('테스트');
  await page.getByRole('button', { name: '생년월일 선택' }).click();
  await expect(page.getByRole('heading', { name: '생년월일 선택' })).toBeVisible();
  await expect(page.getByTestId('keyboard-dock')).toHaveAttribute('data-visible', 'false');
  await page.getByLabel('출생 연도').selectOption('1995');
  await page.getByLabel('출생 월').selectOption('5');
  await page.getByLabel('출생 일').selectOption('17');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(page.getByRole('button', { name: '생년월일 선택' })).toContainText('1995.05.17');
  await page.getByLabel('이메일').fill('new@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();
  await expect(page.getByText('사용할 수 있는 이메일입니다.')).toBeVisible();
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
  const submit = page.getByRole('button', { name: '다음', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole('heading', { name: '약관 동의' })).toBeVisible();
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await expect(page.getByLabel('이름')).toHaveValue('테스트');
  await expect(page.getByRole('button', { name: '생년월일 선택' })).toContainText('1995.05.17');
  await expect(page.getByLabel('이메일')).toHaveValue('new@gift.local');
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('Test1234!');
  await page.getByRole('button', { name: '다음', exact: true }).click();

  const continueButton = page.getByRole('button', { name: '동의하고 회원가입' });
  await expect(continueButton).toBeDisabled();
  await page
    .getByRole('checkbox', { name: '(필수) 개인정보 수집 및 이용 동의서', exact: true })
    .check();
  await page.getByRole('button', { name: '(필수) 개인정보 수집 및 이용 동의서 상세 보기' }).click();
  await expect(page.getByRole('heading', { name: '개인정보 수집 및 이용 동의서' })).toBeVisible();
  await page.getByRole('button', { name: '약관 상세 닫기' }).click();
  await page
    .getByRole('checkbox', {
      name: '(필수) 선물 송수신 이력 정보 수집 및 이용 동의서',
      exact: true,
    })
    .check();
  await expect(
    page.getByRole('checkbox', { name: '(선택) 리뷰·별점 AI 개선 동의', exact: true }),
  ).not.toBeChecked();
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();
});

test('약관 전체 동의는 필수와 선택 항목을 함께 제어한다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.setItem('prototype-auth', 'signed-out'));
  await page.reload();
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByLabel('이름').fill('테스트');
  await page.getByRole('button', { name: '생년월일 선택' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByLabel('이메일').fill('new@gift.local');
  await page.getByRole('button', { name: '중복확인' }).click();
  await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
  await page.getByRole('textbox', { name: '비밀번호 확인', exact: true }).fill('Test1234!');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('전체 동의').check();
  await expect(
    page.getByRole('checkbox', { name: '(필수) 개인정보 수집 및 이용 동의서', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', {
      name: '(필수) 선물 송수신 이력 정보 수집 및 이용 동의서',
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: '(선택) 리뷰·별점 AI 개선 동의', exact: true }),
  ).toBeChecked();
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
