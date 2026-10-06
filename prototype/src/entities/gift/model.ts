import { PRODUCT_IMAGE } from '../../shared/config/assets';

// 백엔드 GiftPolicy.MAX_QUANTITY와 동일한 값. 초과 요청은 생성/사전검증 API에서 모두 400으로 거부된다.
export const MAX_GIFT_QUANTITY = 10;

const GIFT_CONDITION_ERRORS = {
  GIFT_CONDITIONS_CHANGED: {
    title: '가격이 변경됐어요',
    body: '상품 가격이 달라졌습니다. 상품 상세에서 최신 가격을 다시 확인해 주세요.',
  },
  INSUFFICIENT_STOCK: {
    title: '재고가 부족해요',
    body: '선택한 수량만큼 재고가 남아 있지 않습니다. 상품 상세에서 수량을 다시 확인해 주세요.',
  },
} as const;

export function getGiftConditionError(code: string | null) {
  return code && code in GIFT_CONDITION_ERRORS
    ? GIFT_CONDITION_ERRORS[code as keyof typeof GIFT_CONDITION_ERRORS]
    : null;
}

export type ReceivedGift = {
  giftId: number;
  receivedAt: string;
  sender: { userId: number; name: string };
  product: {
    productId: number;
    name: string;
    brand: string;
    thumbnailUrl?: string;
    imageUrl?: string | null;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type SentGift = {
  giftId: number;
  sentAt: string;
  recipient: { userId: number; name: string };
  product: {
    productId: number;
    name: string;
    brand: string;
    thumbnailUrl?: string;
    imageUrl?: string | null;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type GiftPreflight = {
  recipient: { userId: number; name: string };
  product: {
    productId: number;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    maxOrderQuantity: number;
  };
  preferenceWarning: { categoryId: number; categoryName: string } | null;
};

export type SentGiftResult = {
  giftId: number;
  sentAt: string;
  recipientName: string;
  product: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl: string | null;
  };
};

export const mockReceivedGifts: ReceivedGift[] = Array.from({ length: 43 }, (_, index) => ({
  giftId: 410 + index,
  receivedAt: new Date(2026, 7, 31 - (index % 28), 9, 10).toISOString(),
  sender: { userId: 19 + index, name: index % 2 ? '이준호' : '김민지' },
  product: {
    productId: 72 + index,
    name: index % 3 ? '그린티 수분 크림' : '핸드크림 세트',
    brand: index % 3 ? '이니스프리' : '선잘알 셀렉트',
    thumbnailUrl: PRODUCT_IMAGE,
  },
  quantity: (index % 3) + 1,
  unitPrice: 32000,
  totalPrice: 32000 * ((index % 3) + 1),
}));
