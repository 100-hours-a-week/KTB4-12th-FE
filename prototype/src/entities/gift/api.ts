import { apiGet, apiPost, apiPostWithHeaders, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import {
  type GiftPreflight,
  mockReceivedGifts,
  type PaymentComplete,
  type PaymentResult,
  type PaymentStatusResult,
  type ReceivedGift,
  type SentGift,
} from './model';

export async function fetchReceivedGifts(cursor: string | null): Promise<CursorPage<ReceivedGift>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return mockPage(mockReceivedGifts, cursor);
  }
  const data = await apiGet<{ items: ReceivedGift[]; pagination: Pagination }>('/gifts/received', {
    cursor: cursor ?? undefined,
  });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination ?? { nextCursor: null, hasNext: false },
  };
}

export async function fetchSentGifts(cursor: string | null): Promise<CursorPage<SentGift>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return mockPage(mockSentGifts, cursor);
  }
  const data = await apiGet<{ items: SentGift[]; pagination: Pagination }>('/gifts/sent', {
    cursor: cursor ?? undefined,
  });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination ?? { nextCursor: null, hasNext: false },
  };
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

export async function createPayment(
  input: {
    productId: number;
    recipientUserId: number;
    quantity: number;
    expectedUnitPrice: number;
  },
  idempotencyKey: string,
): Promise<PaymentResult> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    const product = mockReceivedGifts.find((item) => item.product.productId === input.productId);
    const unitPrice = product?.unitPrice ?? 32000;
    const now = new Date().toISOString();
    const orderId = crypto.randomUUID();
    const giftId = Date.now();
    const giftExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result: PaymentComplete = {
      orderId,
      paymentKey: `mock-payment-${giftId}`,
      transactionKey: `mock-transaction-${giftId}`,
      paymentStatus: 'COMPLETED',
      giftId,
      giftStatus: 'WAITING_FOR_ACCEPTANCE',
      amount: unitPrice * input.quantity,
      balanceAfter: 500000 - unitPrice * input.quantity,
      approvedAt: now,
      giftExpiresAt,
    };
    mockSentGifts.unshift({
      giftId,
      orderId,
      giftStatus: 'WAITING_FOR_ACCEPTANCE',
      expiresAt: giftExpiresAt,
      paymentStatus: 'COMPLETED',
      sentAt: now,
      recipient: { userId: input.recipientUserId, name: '김민지' },
      product: product?.product ?? mockReceivedGifts[0].product,
      quantity: input.quantity,
      unitPrice,
      totalPrice: unitPrice * input.quantity,
    });
    return result;
  }
  return apiPostWithHeaders<PaymentResult>('/payments', input, {
    'Idempotency-Key': idempotencyKey,
  });
}

export async function fetchPaymentStatus(orderId: string): Promise<PaymentStatusResult> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const gift = mockSentGifts.find((item) => item.orderId === orderId);
    return {
      orderId,
      paymentStatus: gift?.paymentStatus ?? 'PENDING',
      approvalResult: gift ? 'APPROVED' : 'UNKNOWN',
      failureCode: null,
      giftId: gift?.giftId ?? null,
      giftStatus: gift?.giftStatus ?? null,
      amount: gift?.totalPrice ?? 0,
      approvedAt: gift?.sentAt ?? null,
      canceledAt: null,
    };
  }
  return apiGet<PaymentStatusResult>(`/payments/${orderId}`);
}

export async function acceptGift(giftId: number) {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    const gift = mockReceivedGifts.find((item) => item.giftId === giftId);
    if (gift) gift.giftStatus = 'COMPLETED';
    return {
      giftId,
      giftStatus: 'COMPLETED' as const,
      rewardAmount: 100000,
      completedAt: new Date().toISOString(),
    };
  }
  return apiPost<{
    giftId: number;
    giftStatus: 'COMPLETED';
    rewardAmount: number;
    completedAt: string;
  }>(`/gifts/received/${giftId}/accept`);
}

export async function cancelPayment(orderId: string, idempotencyKey: string) {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    const gift = mockSentGifts.find((item) => item.orderId === orderId);
    if (gift) {
      gift.giftStatus = 'CANCELED';
      gift.paymentStatus = 'CANCELED';
    }
    return {
      orderId,
      paymentStatus: 'CANCELED' as const,
      giftId: gift?.giftId ?? 0,
      giftStatus: 'CANCELED' as const,
      canceledAt: new Date().toISOString(),
    };
  }
  return apiPostWithHeaders<{
    orderId: string;
    paymentStatus: 'CANCELED';
    giftId: number;
    giftStatus: 'CANCELED';
    canceledAt: string;
  }>(`/payments/${orderId}/cancellations`, undefined, { 'Idempotency-Key': idempotencyKey });
}

function mockProductPrice(productId: number) {
  const product = mockReceivedGifts.find((item) => item.product.productId === productId);
  return product?.unitPrice ?? 32000;
}

const mockSentGifts: SentGift[] = mockReceivedGifts.slice(0, 12).map((gift, index) => ({
  giftId: gift.giftId,
  orderId: gift.orderId,
  giftStatus: gift.giftStatus,
  expiresAt: gift.expiresAt,
  paymentStatus: gift.giftStatus === 'CANCELED' ? 'CANCELED' : 'COMPLETED',
  sentAt: gift.receivedAt,
  recipient: { userId: 27 + index, name: index % 2 ? '박서연' : '김민지' },
  product: gift.product,
  quantity: gift.quantity,
  unitPrice: gift.unitPrice,
  totalPrice: gift.totalPrice,
}));
