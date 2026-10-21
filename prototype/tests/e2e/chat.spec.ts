import { expect, type Page, test } from '@playwright/test';
async function openChat(page: Page, mode = 'text') {
  await page.goto(`/?chatMock=${mode}`);
  await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
  await page.getByRole('button', { name: '선잘알 봇 열기' }).click();
  await page.getByRole('button', { name: '받는 사람 선택', exact: true }).click();
  await page
    .getByRole('dialog', { name: '받는 사람 선택', exact: true })
    .getByRole('button', { name: '선택', exact: true })
    .first()
    .click();
  await expect(page.getByLabel('채팅 메시지')).toBeVisible();
}
async function submit(page: Page, text = '선물 추천해줘 🎁') {
  await page.getByLabel('채팅 메시지').fill(text);
  await page.getByRole('button', { name: '메시지 전송' }).click();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('prototype-auth', 'signed-in');
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem(
        'authUser',
        JSON.stringify({ userId: 1, name: '홍길동', email: 'me@gift.local' }),
      );
    }
  });
});
for (const mode of ['text', 'long', 'reconnect', 'failed', 'timeout', 'cards']) {
  test(`mock ${mode}: 전송·최종 상태·새로고침 시 중복 방지`, async ({ page }) => {
    await openChat(page, mode);
    await submit(page);
    const status = mode === 'failed' ? 'FAILED' : 'COMPLETED';
    await expect(page.locator(`.ai-chat-message[data-status=${status}]`)).toHaveCount(1, {
      timeout: 15000,
    });
    const answer = await page.locator('.ai-chat-message.assistant[data-turn-id]').textContent();
    await page.reload();
    await expect(page.getByRole('heading', { name: '선잘알 봇' })).toBeVisible();
    await expect(page.locator('.ai-chat-message.user')).toHaveCount(1);
    await expect(page.locator('.ai-chat-message.assistant[data-turn-id]')).toHaveText(answer!);
    await expect(page.getByLabel('채팅 메시지')).toHaveValue('');
  });
}
test('공백 및 Unicode 100자 제한은 전송 가능 길이와 일치한다', async ({ page }) => {
  await openChat(page);
  await page.getByLabel('채팅 메시지').fill('   ');
  await expect(page.getByRole('button', { name: '메시지 전송' })).toBeDisabled();
  await page.getByLabel('채팅 메시지').fill('🎁'.repeat(101));
  await expect(page.getByLabel('채팅 메시지')).toHaveValue('🎁'.repeat(100));
  await expect(page.locator('.ai-composer > span')).toHaveText('100/100');
  await expect(page.getByRole('button', { name: '메시지 전송' })).toBeEnabled();
  await page.getByRole('button', { name: '메시지 전송' }).click();
  await expect(page.locator('.ai-chat-message.user')).toHaveText('🎁'.repeat(100));
});
for (const mode of ['slow', 'delayed_tokens']) {
  test(`mock ${mode}: PROCESSING 새로고침·화면 이동·명시적 취소`, async ({ page }) => {
    await openChat(page, mode);
    await submit(page);
    await expect(page.getByRole('button', { name: '답변 생성 정지' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: '답변 생성 정지' })).toBeVisible();
    await page.getByRole('button', { name: '뒤로 가기' }).click();
    await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
    await page.getByRole('button', { name: '선잘알 봇 열기' }).click();
    await expect(page.locator('.ai-chat-message.user')).toHaveCount(1);
    await page.getByRole('button', { name: '답변 생성 정지' }).click();
    await expect(page.locator('.ai-chat-message[data-status=CANCELLED]')).toBeVisible();
    await page.reload();
    await expect(page.locator('.ai-chat-message[data-status=CANCELLED]')).toBeVisible();
  });
}
test('sessionStorage 저장 실패 중에도 대화는 동작한다', async ({ page }) => {
  await openChat(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('quota');
    };
  });
  await submit(page);
  await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toBeVisible();
});
test('손상·이전 버전·다른 사용자 기록을 정리한다', async ({ page }) => {
  await page.goto('/');
  for (const value of [
    '{broken',
    JSON.stringify({ version: 0 }),
    JSON.stringify({ version: 1, userId: 2 }),
  ]) {
    await page.evaluate((v) => sessionStorage.setItem('gift-chat:v1:1', v), value);
    await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
    await page.getByRole('button', { name: '선잘알 봇 열기' }).click();
    await expect(page.getByRole('button', { name: '받는 사람 선택', exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('gift-chat:v1:1'))).toBeNull();
    await page.getByRole('button', { name: '뒤로 가기' }).click();
  }
});
test('새 메시지 스크롤과 돌아왔을 때 저장 위치 복원', async ({ page }) => {
  await openChat(page, 'long');
  await submit(page);
  await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toBeVisible({
    timeout: 15000,
  });
  const scroll = page.locator('[data-testid=mobile-scroll]:not(.route-preserved-scroll)');
  await scroll.evaluate((node) => {
    node.scrollTop = 150;
  });
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBe(150);
  await page.getByRole('button', { name: '뒤로 가기' }).dispatchEvent('click');
  await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
  await page.getByRole('button', { name: '선잘알 봇 열기' }).click();
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBe(150);
  await page.reload();
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBe(150);
});

test('다른 탭의 계정 변경은 이전 화면을 닫고 다른 사용자 기록을 분리한다', async ({
  page,
  context,
}) => {
  await openChat(page, 'slow');
  await submit(page, '계정 1의 질문');
  await expect(page.locator('.ai-chat-message[data-status=PROCESSING]')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() => {
    localStorage.setItem(
      'authUser',
      JSON.stringify({ userId: 2, name: '다른 사용자', email: 'other@gift.local' }),
    );
    localStorage.setItem('accessToken', 'second-token');
  });
  await expect(page.locator('[data-testid=gift-app]')).toHaveAttribute('data-route', 'friends');
  await page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기' }).click();
  await page.getByRole('button', { name: '선잘알 봇 열기' }).click();
  await expect(page.getByRole('button', { name: '받는 사람 선택', exact: true })).toBeVisible();
  await expect(page.getByText('계정 1의 질문')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('gift-chat:v1:1'))).toBeNull();
  await other.close();
});
test('로그아웃은 대화 sessionStorage도 비운다', async ({ page }) => {
  await openChat(page);
  await submit(page);
  await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toBeVisible();
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await page
    .getByRole('navigation', { name: '하단 메뉴' })
    .getByRole('button', { name: '마이' })
    .click();
  await page.getByRole('button', { name: '내 정보 관리' }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((k) => k.startsWith('gift-chat:')),
    ),
  ).toEqual([]);
});

test('첫 질문 전에도 선택 수신자와 대화 UUID를 복원한다', async ({ page }) => {
  await openChat(page);
  const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gift-chat:v1:1')!));
  await page.reload();
  await expect(page.getByLabel('채팅 메시지')).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gift-chat:v1:1')!));
  expect(after.conversationId).toBe(before.conversationId);
  expect(after.recipient).toEqual(before.recipient);
  await expect(page.locator('.ai-chat-message.user')).toHaveCount(0);
});

test('선잘알 캐릭터 진입 버튼과 받는 사람 선택 안내를 표시한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: '선잘알 봇 및 의견 메뉴 열기', exact: true });
  await expect(menu.locator('img')).toHaveAttribute('src', '/assets/brand/sunjalal-bot.png');
  await menu.click();
  await page.getByRole('button', { name: '선잘알 봇 열기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '선잘알 봇', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '선잘알 캐릭터' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '누구에게 마음을 전할까요?' })).toBeVisible();
  await expect(page.getByRole('button', { name: '받는 사람 선택', exact: true })).toBeEnabled();
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: '선잘알 캐릭터' })
        .evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page
    .getByTestId('gift-app')
    .screenshot({ path: testInfo.outputPath('sunjalal-bot-welcome.png') });
  await page.getByRole('button', { name: '받는 사람 선택', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '받는 사람 선택', exact: true })).toBeVisible();
});

test('채팅 입력창은 대화 공간을 확보하고 의견 버튼과 겹치지 않는다', async ({ page }, testInfo) => {
  await openChat(page, 'long');
  await submit(page);
  await expect(page.locator('.ai-chat-message[data-status=COMPLETED]')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole('dialog', { name: '받는 사람 선택', exact: true })).toBeHidden();
  const coverage = await page.locator('.ai-chat-controls').evaluate((node) => {
    const style = getComputedStyle(node);
    const fill = getComputedStyle(node, '::after');
    const bounds = node.getBoundingClientRect();
    const parent = node.parentElement!.getBoundingClientRect();
    return {
      left: bounds.left - parent.left,
      right: parent.right - bounds.right,
      bottomGap: parent.bottom - bounds.bottom - parseFloat(fill.height),
      background: style.backgroundColor,
      fill: fill.backgroundColor,
    };
  });
  expect(coverage.left).toBeCloseTo(0);
  expect(coverage.right).toBeCloseTo(0);
  expect(coverage.bottomGap).toBeCloseTo(0);
  expect(coverage.background).toBe('rgb(255, 250, 248)');
  expect(coverage.fill).toBe(coverage.background);
  const composer = await page.locator('.ai-composer').boundingBox();
  const feedback = await page
    .getByRole('button', { name: '의견 남기기', exact: true })
    .boundingBox();
  expect(composer).not.toBeNull();
  expect(feedback).not.toBeNull();
  expect(composer!.height).toBeLessThan(130);
  expect(feedback!.y + feedback!.height).toBeLessThan(composer!.y);
  await page.getByRole('button', { name: '친구 생일 선물', exact: true }).click();
  await expect(page.getByLabel('채팅 메시지')).toHaveValue('친한 친구의 생일 선물을 추천해줘');
  await page.getByTestId('gift-app').screenshot({ path: testInfo.outputPath('chat-ux.png') });
});
