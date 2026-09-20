import { PRODUCT_IMAGE } from '../../shared/config/assets';

export type ReceivedGift = {
  giftId: number;
  receivedAt: string;
  sender: { userId: number; name: string };
  product: { productId: number; name: string; brand: string; thumbnailUrl: string };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type SentGift = {
  giftId: number;
  sentAt: string;
  recipient: { userId: number; name: string };
  product: { productId: number; name: string; brand: string; thumbnailUrl: string };
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
    imageUrl: string;
  };
};

export type GiftReview = {
  reviewId: number;
  giftId: number;
  rating: number;
  content: string | null;
  createdAt: string;
  updatedAt: string;
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
