export type RouletteParticipation = {
  date: string;
  nextResetAt: string;
  attendanceGranted: number;
  giftGranted: number;
  used: number;
  remaining: number;
  dailyRemaining: number;
};

export type RouletteSegment = {
  segmentId: number;
  rewardType: 'COUPON' | 'MISS';
  multiplier: 2 | 3 | null;
  probability: number;
};

export type RouletteStatus = RouletteParticipation & {
  serverTime: string;
  rewardVersion?: string;
  segments?: RouletteSegment[];
};
export type RouletteAttendance = RouletteParticipation & { granted: boolean };
export type RouletteSpin = {
  spinId: number;
  date: string;
  segmentId: number;
  rewardType: 'COUPON' | 'MISS';
  multiplier: 2 | 3 | null;
  rewardVersion: string;
  remaining: number;
};
