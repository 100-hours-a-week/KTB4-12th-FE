import { apiGet, apiPost, apiPostWithHeaders, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import {
  type GiftPreflight,
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
  const data = await apiPostWithHeaders<{ gift: SentGiftResult }>('/gifts', input, {
    'Idempotency-Key': idempotencyKey,
  });
  return data.gift;
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
