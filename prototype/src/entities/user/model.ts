export type GiftSummary = {
  sentCount: number;
  receivedCount: number;
  period: {
    from: string;
    to: string;
  };
};

export type MyProfile = {
  userId: number;
  name: string;
  email: string;
  birth: string;
  isBirthdayPublic: boolean;
  giftSummary: GiftSummary;
};

export type SearchedUser = {
  userId: number;
  name: string;
  email: string;
};
