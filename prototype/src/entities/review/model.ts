export type GiftReview = {
  reviewId: number;
  giftId: number;
  rating: number;
  content: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewInput = {
  rating: number;
  content?: string | null;
};
