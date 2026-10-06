import type { Page } from '@playwright/test';

type GiftErrorConfig = {
  quantity: number;
  status: number;
  code: string;
  message: string;
};

export type GiftRequest = {
  body: unknown;
  idempotencyKey: string | undefined;
};

export async function setupGiftErrorRoutes(page: Page, config: GiftErrorConfig) {
  const requests: GiftRequest[] = [];
  const recipient = {
    friendId: 31,
    userId: 27,
    name: '김민지',
    email: 'friend1@gift.local',
    birth: '2000-01-01',
  };
  const product = {
    productId: 101,
    brandName: '선잘알 셀렉트',
    productName: '포근한 데일리 선물 세트',
    price: 32000,
    thumbnailUrl: '',
  };

  await page.route('**/products/categories', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: '카테고리를 조회했습니다.', data: { categories: [] } }),
    }),
  );
  await page.route(/\/friends(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '친구 목록을 조회했습니다.',
        data: { friends: [recipient], pagination: { nextCursor: null, hasNext: false } },
      }),
    }),
  );
  await page.route(/\/products(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '상품을 조회했습니다.',
        data: {
          products: [product],
          pagination: { nextCursor: null, hasNext: false },
          appliedSort: 'AI_RECOMMENDED',
        },
      }),
    }),
  );
  await page.route('**/products/101', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '상품 상세를 조회했습니다.',
        data: {
          product: {
            productId: 101,
            brandName: '선잘알 셀렉트',
            productName: '포근한 데일리 선물 세트',
            description: '선물하기 좋은 상품입니다.',
            unitPrice: 32000,
            images: [],
            stockQuantity: 8,
          },
        },
      }),
    }),
  );
  await page.route('**/gifts/preflight', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: '선물 조건을 확인했습니다.',
        data: {
          recipient: { userId: 27, name: '김민지' },
          product: {
            productId: 101,
            unitPrice: 32000,
            quantity: config.quantity,
            totalPrice: 32000 * config.quantity,
            maxOrderQuantity: 5,
          },
          preferenceWarning: null,
        },
      }),
    }),
  );
  await page.route(/\/gifts$/, async (route) => {
    requests.push({
      body: route.request().postDataJSON(),
      idempotencyKey: route.request().headers()['idempotency-key'],
    });
    await route.fulfill({
      status: config.status,
      contentType: 'application/json',
      body: JSON.stringify({
        message: config.message,
        error: { code: config.code, traceId: '01JXYZ8D7G5K2M4N6P8Q' },
      }),
    });
  });

  return requests;
}
