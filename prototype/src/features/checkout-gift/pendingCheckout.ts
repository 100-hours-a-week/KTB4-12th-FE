import type { GiftPreflight, PaymentRequest } from '../../entities/gift';
import { loadSession } from '../../shared/api/session';

const STORAGE_KEY = 'gift-pending-checkout';
export type PendingCheckout = {
  userId: number | null;
  key: string;
  input: PaymentRequest;
  preflight: GiftPreflight;
  productName: string;
  imageUrl: string;
  orderId: string | null;
};

export function getPendingCheckout(): PendingCheckout | null {
  try {
    const session = loadSession();
    const pending = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as PendingCheckout | null;
    if (!session || !pending || pending.userId !== (session.user?.userId ?? null)) return null;
    const input = pending.input;
    if (
      !input ||
      !pending.key ||
      !Number.isInteger(input.productId) ||
      input.productId <= 0 ||
      !Number.isInteger(input.recipientUserId) ||
      input.recipientUserId <= 0 ||
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      input.quantity > 10 ||
      !Number.isSafeInteger(input.expectedUnitPrice) ||
      input.expectedUnitPrice < 0 ||
      (input.couponMultiplier != null &&
        input.couponMultiplier !== 2 &&
        input.couponMultiplier !== 3) ||
      pending.preflight?.recipient.userId !== input.recipientUserId ||
      pending.preflight?.product.productId !== input.productId ||
      pending.preflight.product.quantity !== input.quantity ||
      pending.preflight.product.unitPrice !== input.expectedUnitPrice
    )
      return null;
    return pending;
  } catch {
    return null;
  }
}

export function savePendingCheckout(pending: PendingCheckout) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

export function clearPendingCheckout() {
  sessionStorage.removeItem(STORAGE_KEY);
}
