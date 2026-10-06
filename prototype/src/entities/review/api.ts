import { apiDelete, apiGet, apiPatch, apiPost } from '../../shared/api/client';
import type { GiftReview, ReviewInput } from './model';

type ReviewResponse = { review: GiftReview };

export async function fetchGiftReview(giftId: number): Promise<GiftReview> {
  const data = await apiGet<ReviewResponse>(`/gifts/${giftId}/review`);
  return data.review;
}

export async function createGiftReview(giftId: number, input: ReviewInput): Promise<GiftReview> {
  const data = await apiPost<ReviewResponse>(`/gifts/${giftId}/review`, input);
  return data.review;
}

export async function updateGiftReview(
  giftId: number,
  input: Partial<ReviewInput>,
): Promise<GiftReview> {
  const data = await apiPatch<ReviewResponse>(`/gifts/${giftId}/review`, input);
  return data.review;
}

export function deleteGiftReview(giftId: number) {
  return apiDelete<{ giftId: number; reviewStatus: 'NOT_WRITTEN' }>(`/gifts/${giftId}/review`);
}
