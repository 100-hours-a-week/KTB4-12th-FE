export type GiftSummary = {
  sentCount: number;
  receivedCount: number;
};

export type MyProfile = {
  userId: number;
  name: string;
  email: string;
  birth: string;
  isBirthdayPublic: boolean;
  creditBalance: number;
  giftSummary: GiftSummary;
};

export type SearchedUser = {
  userId: number;
  name: string;
  email: string;
};
