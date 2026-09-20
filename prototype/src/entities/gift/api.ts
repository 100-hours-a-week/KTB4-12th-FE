import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPostWithHeaders,
  USE_MOCK_API,
} from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import {
  type GiftPreflight,
  type GiftReview,
  mockReceivedGifts,
  type ReceivedGift,
  type SentGift,
  type SentGiftResult,
} from './model';

export async function fetchReceivedGifts(cursor: string | null): Promise<CursorPage<ReceivedGift>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return mockPage(mockReceivedGifts, cursor);
  }
  const data = await apiGet<{ items: ReceivedGift[]; pagination: Pagination }>('/gifts/received', {
    cursor: cursor ?? undefined,
  });
  return { items: data.items, pagination: data.pagination };
}

export async function fetchSentGifts(cursor: string | null): Promise<CursorPage<SentGift>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return mockPage(mockSentGifts, cursor);
  }
  const data = await apiGet<{ items: SentGift[]; pagination: Pagination }>('/gifts/sent', {
    cursor: cursor ?? undefined,
  });
  return { items: data.items, pagination: data.pagination };
}

export async function fetchSentGiftDetail(giftId: number): Promise<SentGift> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    return mockSentGifts.find((gift) => gift.giftId === giftId) ?? mockSentGifts[0];
  }
  return apiGet<SentGift>(`/gifts/sent/${giftId}`);
}

export async function fetchReceivedGiftDetail(giftId: number): Promise<ReceivedGift> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    return mockReceivedGifts.find((gift) => gift.giftId === giftId) ?? mockReceivedGifts[0];
  }
  return apiGet<ReceivedGift>(`/gifts/received/${giftId}`);
}

export async function preflightGift(input: {
  productId: number;
  recipientUserId: number;
  quantity: number;
}): Promise<GiftPreflight> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    const product = mockProductPrice(input.productId);
    return {
      recipient: { userId: input.recipientUserId, name: '김민지' },
      product: {
        productId: input.productId,
        unitPrice: product,
        quantity: input.quantity,
        totalPrice: product * input.quantity,
        maxOrderQuantity: 5,
      },
      preferenceWarning: null,
    };
  }
  return apiPost<GiftPreflight>('/gifts/preflight', input);
}

export async function sendGift(
  input: {
    productId: number;
    recipientUserId: number;
    quantity: number;
    expectedUnitPrice: number;
  },
  idempotencyKey: string,
): Promise<SentGiftResult> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    const product = mockReceivedGifts.find((item) => item.product.productId === input.productId);
    const unitPrice = product?.unitPrice ?? 32000;
    return {
      giftId: 501,
      sentAt: new Date().toISOString(),
      recipientName: '김민지',
      product: {
        productName: product?.product.name ?? '그린티 수분 크림',
        quantity: input.quantity,
        unitPrice,
        totalPrice: unitPrice * input.quantity,
        imageUrl: product?.product.thumbnailUrl ?? '',
      },
    };
  }
  return apiPostWithHeaders<SentGiftResult>('/gifts', input, { 'Idempotency-Key': idempotencyKey });
}

export async function fetchGiftReview(giftId: number): Promise<GiftReview> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    return {
      reviewId: 71,
      giftId,
      rating: 5,
      content: '정말 만족스러운 선물이었어요.',
      createdAt: '2026-07-03T15:20:30+09:00',
      updatedAt: '2026-07-03T15:20:30+09:00',
    };
  }
  const data = await apiGet<{ review: GiftReview }>(`/gifts/${giftId}/review`);
  return data.review;
}

export async function createGiftReview(
  giftId: number,
  input: { rating: number; content?: string | null },
): Promise<GiftReview> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return {
      reviewId: 71,
      giftId,
      rating: input.rating,
      content: input.content ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  const data = await apiPost<{ review: GiftReview }>(`/gifts/${giftId}/review`, input);
  return data.review;
}

export async function updateGiftReview(
  giftId: number,
  input: { rating?: number; content?: string | null },
): Promise<GiftReview> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return {
      reviewId: 71,
      giftId,
      rating: input.rating ?? 5,
      content: input.content !== undefined ? input.content : '정말 만족스러운 선물이었어요.',
      createdAt: '2026-07-03T15:20:30+09:00',
      updatedAt: new Date().toISOString(),
    };
  }
  const data = await apiPatch<{ review: GiftReview }>(`/gifts/${giftId}/review`, input);
  return data.review;
}

export async function deleteGiftReview(
  giftId: number,
): Promise<{ giftId: number; reviewStatus: 'NOT_WRITTEN' }> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return { giftId, reviewStatus: 'NOT_WRITTEN' };
  }
  return apiDelete(`/gifts/${giftId}/review`);
}

function mockProductPrice(productId: number) {
  const product = mockReceivedGifts.find((item) => item.product.productId === productId);
  return product?.unitPrice ?? 32000;
}

const mockSentGifts: SentGift[] = mockReceivedGifts.slice(0, 12).map((gift, index) => ({
  giftId: gift.giftId,
  sentAt: gift.receivedAt,
  recipient: { userId: 27 + index, name: index % 2 ? '박서연' : '김민지' },
  product: gift.product,
  quantity: gift.quantity,
  unitPrice: gift.unitPrice,
  totalPrice: gift.totalPrice,
}));
