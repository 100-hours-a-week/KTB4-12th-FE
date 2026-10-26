import {
  ApiError,
  apiGet,
  apiPost,
  apiPostWithHeaders,
  USE_MOCK_API,
} from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import { changeMockCoupon } from './coupons';
import {
  type GiftPreflight,
  mockReceivedGifts,
  type PaymentComplete,
  type PaymentRequest,
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

export function getMockGiftSummaryCounts() {
  return {
    sentCount: mockSentGifts.length,
    receivedCount: mockReceivedGifts.length,
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
  input: PaymentRequest,
  idempotencyKey: string,
): Promise<PaymentResult> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    const orders = readMockOrders();
    const previous = orders[idempotencyKey];
    if (previous) {
      if (JSON.stringify(previous.input) !== JSON.stringify(input))
        throw new ApiError('동일한 요청 키를 다른 요청에 사용할 수 없습니다.', 409, {
          code: 'IDEMPOTENCY_KEY_CONFLICT',
        });
      if (previous.gift.paymentStatus === 'CANCELED')
        throw new ApiError('현재 주문 상태에서는 결제를 완료할 수 없습니다.', 409, {
          code: 'PAYMENT_STATE_CONFLICT',
        });
      return previous.result;
    }
    const product = mockReceivedGifts.find((item) => item.product.productId === input.productId);
    const unitPrice = input.expectedUnitPrice;
    if (input.couponMultiplier) changeMockCoupon(input.couponMultiplier, -1);
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
      couponMultiplier: input.couponMultiplier ?? null,
      couponStatus: input.couponMultiplier ? 'USED' : null,
      expectedRewardAmount: 50000 * (input.couponMultiplier ?? 1),
      rewardAmount: null,
    };
    const gift: SentGift = {
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
    };
    mockSentGifts.unshift(gift);
    orders[idempotencyKey] = { input, result, gift };
    sessionStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(orders));
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
      ...mockReward(orderId, gift),
    };
  }
  return apiGet<PaymentStatusResult>(`/payments/${orderId}`);
}

export async function acceptGift(giftId: number) {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    const gift = mockReceivedGifts.find((item) => item.giftId === giftId);
    if (gift) gift.giftStatus = 'COMPLETED';
    const orders = readMockOrders();
    const stored = Object.values(orders).find((order) => order.gift.giftId === giftId);
    const rewardAmount =
      stored?.result.rewardAmount ?? 50000 * (stored?.input.couponMultiplier ?? 1);
    if (stored) {
      stored.gift.giftStatus = 'COMPLETED';
      stored.result.giftStatus = 'COMPLETED';
      stored.result.expectedRewardAmount = null;
      stored.result.rewardAmount = rewardAmount;
      sessionStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(orders));
      const sent = mockSentGifts.find((item) => item.giftId === giftId);
      if (sent) sent.giftStatus = 'COMPLETED';
    }
    return {
      giftId,
      giftStatus: 'COMPLETED' as const,
      rewardAmount,
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
    const orders = readMockOrders();
    const stored = Object.values(orders).find((order) => order.result.orderId === orderId);
    if (stored && stored.result.couponStatus === 'USED' && stored.input.couponMultiplier) {
      changeMockCoupon(stored.input.couponMultiplier, 1);
      stored.result.couponStatus = 'RESTORED';
    }
    if (stored) {
      stored.gift.giftStatus = 'CANCELED';
      stored.gift.paymentStatus = 'CANCELED';
      stored.result.expectedRewardAmount = null;
      sessionStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(orders));
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

const MOCK_ORDERS_KEY = 'gift-mock-orders';
type MockOrder = { input: PaymentRequest; result: PaymentComplete; gift: SentGift };
function readMockOrders(): Record<string, MockOrder> {
  return JSON.parse(sessionStorage.getItem(MOCK_ORDERS_KEY) ?? '{}') as Record<string, MockOrder>;
}
function mockReward(orderId: string, gift?: SentGift) {
  const order = Object.values(readMockOrders()).find((item) => item.result.orderId === orderId);
  if (order)
    return {
      couponMultiplier: order.result.couponMultiplier,
      couponStatus: order.result.couponStatus,
      expectedRewardAmount: order.result.expectedRewardAmount,
      rewardAmount: order.result.rewardAmount,
    };
  return {
    couponMultiplier: null,
    couponStatus: null,
    expectedRewardAmount: gift?.giftStatus === 'WAITING_FOR_ACCEPTANCE' ? 50000 : null,
    rewardAmount: gift?.giftStatus === 'COMPLETED' ? 100000 : null,
  };
}

const mockSentGifts: SentGift[] = [
  ...Object.values(readMockOrders()).map((order) => order.gift),
  ...mockReceivedGifts.slice(0, 12).map((gift, index) => ({
    giftId: gift.giftId,
    orderId: gift.orderId,
    giftStatus: gift.giftStatus,
    expiresAt: gift.expiresAt,
    paymentStatus: (gift.giftStatus === 'CANCELED'
      ? 'CANCELED'
      : 'COMPLETED') as SentGift['paymentStatus'],
    sentAt: gift.receivedAt,
    recipient: { userId: 27 + index, name: index % 2 ? '박서연' : '김민지' },
    product: gift.product,
    quantity: gift.quantity,
    unitPrice: gift.unitPrice,
    totalPrice: gift.totalPrice,
  })),
];
