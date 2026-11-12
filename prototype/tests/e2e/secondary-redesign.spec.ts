import { expect, type Page, test } from '@playwright/test';

async function capture(page: Page, width: number, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  const sheet = page.locator('.bottom-sheet[data-state="open"]');
  if (await sheet.count()) {
    await expect(sheet).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  }
  const dialog = page.locator('.app-dialog:visible');
  if (await dialog.count()) await expect(dialog).toHaveCSS('opacity', '1');
  await page
    .getByTestId('gift-app')
    .screenshot({ path: `/tmp/seonjalal-redesign/all-${width}-${name}.png` });
}
async function signIn(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('prototype-auth', 'signed-in');
    localStorage.setItem('accessToken', 'prototype-test-token');
  });
  await page.goto('/?chatMock=text');
}
for (const width of [320, 390, 1100]) {
  test(`${width}px 설정·취향·선물 내역·상세 화면을 같은 위계로 탐색한다`, async ({ page }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page);
    await page.getByRole('button', { name: /알림 목록 열기/ }).click();
    const notifications = page.getByRole('dialog', { name: '알림', exact: true });
    await expect(notifications.locator('.notification-card').first()).toBeVisible();
    await capture(page, width, 'notifications');
    await notifications.getByRole('button', { name: '알림 닫기', exact: true }).click();
    await expect(notifications).toBeHidden();
    await page.getByRole('navigation').getByRole('button', { name: '마이', exact: true }).click();
    await page.getByRole('button', { name: '내 정보 및 공개 설정 설정', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '내 정보 및 공개 설정', exact: true }),
    ).toBeVisible();
    await capture(page, width, 'account');
    await page.getByRole('button', { name: /생년월일/ }).click();
    const birthday = page.getByRole('dialog', { name: '생년월일 수정' });
    await expect(birthday).toBeVisible();
    await capture(page, width, 'birthday');
    await birthday.getByRole('button', { name: '취소', exact: true }).click();
    await expect(birthday).toBeHidden();
    await page.getByRole('button', { name: '뒤로 가기' }).click();
    await page.getByRole('button', { name: '비선호 카테고리 설정', exact: true }).click();
    await expect(page.getByRole('heading', { name: '비선호 카테고리', exact: true })).toBeVisible();
    await capture(page, width, 'preferences');
    await page.getByRole('button', { name: '뒤로 가기' }).click();
    await page.getByRole('button', { name: '내 선물 취향 작성', exact: true }).click();
    const preference = page.getByRole('textbox', { name: '내 선물 취향', exact: true });
    await expect(preference).toBeVisible();
    await preference.fill('실용적이고 편안한 선물을 좋아해요.');
    await capture(page, width, 'gift-preference');
    await page.getByRole('button', { name: '뒤로 가기' }).click();
    const confirm = page.getByRole('dialog', { name: '변경사항을 저장하지 않고 나갈까요?' });
    await expect(confirm).toBeVisible();
    await capture(page, width, 'confirm');
    await confirm.getByRole('button', { name: '나가기', exact: true }).click();
    for (const label of ['받은 선물', '보낸 선물']) {
      await page.getByRole('button', { name: new RegExp(`^${label} \\d+건$`) }).click();
      const card = page.locator('.gift-history-card').first();
      await expect(card).toBeVisible();
      await capture(page, width, label === '받은 선물' ? 'received' : 'sent');
      await card.click();
      await expect(page.getByRole('heading', { name: `${label} 상세`, exact: true })).toBeVisible();
      await expect(page.locator('.gift-detail-card')).toBeVisible();
      if (label === '받은 선물')
        await expect(page.locator('.gift-detail-card')).not.toContainText('총 가격');
      else await expect(page.locator('.gift-detail-card')).toContainText('총 가격');
      await capture(page, width, label === '받은 선물' ? 'received-detail' : 'sent-detail');
      await page.getByRole('button', { name: '뒤로 가기' }).click();
      await page.getByRole('button', { name: '뒤로 가기' }).click();
    }
  });

  test(`${width}px 상품 상세·수신자 시트·채팅의 이미지 비율과 입력 하단을 유지한다`, async ({
    page,
  }) => {
    test.setTimeout(40_000);
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page);
    await page.getByRole('navigation').getByRole('button', { name: '선물', exact: true }).click();
    await page.locator('.product-card').first().click();
    await expect(page.locator('.product-hero')).toBeVisible();
    await expect(page.getByRole('button', { name: /선물하기/ })).toBeEnabled();
    const image = await page.locator('.product-hero').evaluate((node) => {
      const image = node as HTMLImageElement;
      return {
        natural: image.naturalWidth / image.naturalHeight,
        rendered: image.clientWidth / image.clientHeight,
      };
    });
    expect(image.rendered).toBeCloseTo(image.natural, 1);
    await capture(page, width, 'product');
    await page.getByRole('button', { name: '수량 늘리기' }).click();
    await expect(page.locator('.quantity-row strong')).toHaveText('2');
    await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
    await page.getByRole('button', { name: '선잘알 봇 열기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '누구에게 마음을 전할까요?' })).toBeVisible();
    await capture(page, width, 'chat-welcome');
    await page.getByRole('button', { name: '받는 사람 선택', exact: true }).click();
    const recipients = page.getByRole('dialog', { name: '받는 사람 선택', exact: true });
    await expect(recipients.locator('.friend-card').first()).toBeVisible();
    await capture(page, width, 'recipients');
    await recipients.getByRole('button', { name: '선택', exact: true }).first().click();
    await expect(recipients).toBeHidden();
    await page.getByLabel('채팅 메시지').fill('친구에게 줄 생일 선물을 추천해줘');
    await page.getByRole('button', { name: '메시지 전송', exact: true }).click();
    await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toBeVisible();
    const inset = await page.locator('.ai-chat-controls').evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        bottom: style.bottom,
        fill: getComputedStyle(node, '::after').height,
        opacity: style.opacity,
      };
    });
    expect(inset.bottom).toBe(inset.fill);
    expect(inset.opacity).toBe('1');
    await capture(page, width, 'chat');
  });

  test(`${width}px 로그인·가입·약관 및 의견 모달에서 입력과 단계가 유지된다`, async ({ page }) => {
    test.setTimeout(40_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem('prototype-auth', 'signed-out');
      localStorage.removeItem('accessToken');
    });
    await page.route('**/auth/terms', (route) =>
      route.fulfill({
        json: {
          data: {
            terms: [
              {
                termId: 1,
                termCode: 'PRIVACY_COLLECTION_USE',
                version: 1,
                isRequired: true,
                title: '개인정보 수집 및 이용 동의서',
                content: '개인정보 수집 및 이용 안내\n\n1. 수집 정보\n이름과 이메일을 수집합니다.',
              },
              {
                termId: 2,
                termCode: 'GIFT_HISTORY',
                version: 1,
                isRequired: true,
                title: '선물 이력 정보 수집 동의서',
                content: '선물 이력 정보 수집 안내',
              },
            ],
          },
        },
      }),
    );
    await page.goto('/');
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeDisabled();
    await capture(page, width, 'login');
    await page.getByRole('button', { name: '회원가입', exact: true }).click();
    await expect(page.getByText('회원가입 1 / 2 · 회원 정보')).toBeVisible();
    await page.getByLabel('이름', { exact: true }).fill('테스트');
    await page.getByRole('button', { name: '생년월일 선택', exact: true }).click();
    await page.getByRole('button', { name: '선택 완료', exact: true }).click();
    await page.getByLabel('이메일', { exact: true }).fill('design@example.com');
    await page.getByRole('button', { name: '중복확인', exact: true }).click();
    await expect(page.getByText('사용할 수 있는 이메일입니다.')).toBeVisible();
    await page.getByRole('button', { name: '인증번호 발송', exact: true }).click();
    await page.getByLabel('이메일 인증번호', { exact: true }).fill('123456');
    await page.getByRole('button', { name: '인증 확인', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('이메일 인증 완료');
    await page.getByLabel('비밀번호', { exact: true }).fill('Test1234!');
    await page.getByLabel('비밀번호 확인', { exact: true }).fill('Test1234!');
    await expect(page.getByRole('button', { name: '다음', exact: true })).toBeEnabled();
    await capture(page, width, 'signup');
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page.getByText('회원가입 2 / 2 · 약관 확인')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /개인정보 수집/ })).toBeVisible();
    await capture(page, width, 'terms');
    await page.getByRole('button', { name: '의견 남기기', exact: true }).click();
    const report = page.getByRole('dialog', { name: '의견 남기기', exact: true });
    await expect(report).toBeVisible();
    await report.getByRole('button', { name: /도움/ }).click();
    await expect(report.getByText('스크린샷 첨부')).toHaveCount(0);
    await capture(page, width, 'report');
    await report.getByRole('button', { name: '취소', exact: true }).click();
  });
}
