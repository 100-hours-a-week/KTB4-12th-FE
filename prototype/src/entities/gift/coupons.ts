import { ApiError, apiGet, USE_MOCK_API } from '../../shared/api/client';

export type CouponMultiplier = 2 | 3;
export type CouponInventory = {
  coupons: { multiplier: CouponMultiplier; quantity: number }[];
  baseRewardAmount: number;
};

const MOCK_COUPONS_KEY = 'gift-mock-coupons';

function mockInventory(): CouponInventory {
  const stored = sessionStorage.getItem(MOCK_COUPONS_KEY);
  return stored
    ? (JSON.parse(stored) as CouponInventory)
    : {
        baseRewardAmount: 50000,
        coupons: [
          { multiplier: 2, quantity: 2 },
          { multiplier: 3, quantity: 1 },
        ],
      };
}

export async function fetchCoupons(): Promise<CouponInventory> {
  if (!USE_MOCK_API) {
    const inventory = await apiGet<CouponInventory>('/coupons');
    if (
      !Number.isSafeInteger(inventory?.baseRewardAmount) ||
      inventory.baseRewardAmount <= 0 ||
      !Array.isArray(inventory.coupons) ||
      inventory.coupons.some(
        (coupon) =>
          ![2, 3].includes(coupon.multiplier) ||
          !Number.isSafeInteger(coupon.quantity) ||
          coupon.quantity < 0,
      )
    ) {
      throw new Error('쿠폰 정보를 확인하지 못했습니다. 다시 조회하거나 쿠폰 없이 진행해 주세요.');
    }
    return inventory;
  }
  await new Promise((resolve) => setTimeout(resolve, 180));
  const inventory = mockInventory();
  return { ...inventory, coupons: inventory.coupons.filter((coupon) => coupon.quantity > 0) };
}

export function changeMockCoupon(multiplier: CouponMultiplier, delta: 1 | -1) {
  const inventory = mockInventory();
  const coupon = inventory.coupons.find((item) => item.multiplier === multiplier);
  if (!coupon || coupon.quantity + delta < 0) {
    throw new ApiError('선택한 쿠폰의 사용 가능 수량이 부족합니다.', 422, {
      code: 'COUPON_NOT_AVAILABLE',
    });
  }
  coupon.quantity += delta;
  sessionStorage.setItem(MOCK_COUPONS_KEY, JSON.stringify(inventory));
}
