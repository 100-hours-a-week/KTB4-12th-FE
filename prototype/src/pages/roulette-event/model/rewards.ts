import type { RouletteSpin, RouletteStatus } from '../../../entities/roulette';

export const ROULETTE_REWARDS = [
  { value: '2배', caption: '보상 쿠폰', label: '보상 2배 쿠폰', multiplier: 2 },
  { value: '3배', caption: '보상 쿠폰', label: '보상 3배 쿠폰', multiplier: 3 },
  { value: '꽝', caption: '다음 기회에', label: '아쉽지만 꽝이에요' },
  { value: '2배', caption: '보상 쿠폰', label: '보상 2배 쿠폰', multiplier: 2 },
  { value: '꽝', caption: '다음 기회에', label: '아쉽지만 꽝이에요' },
  { value: '꽝', caption: '다음 기회에', label: '아쉽지만 꽝이에요' },
] as const;

export type RouletteResult = {
  index: number;
  label: string;
  description: string;
  won: boolean;
};

export function hasRouletteBoard(status: RouletteStatus | null) {
  const segments = status?.segments;
  if (!status?.rewardVersion || !Array.isArray(segments) || segments.length !== 6) return false;
  const types = ['COUPON', 'COUPON', 'MISS', 'COUPON', 'MISS', 'MISS'];
  const multipliers = [2, 3, null, 2, null, null];
  return (
    segments.every(
      (segment, index) =>
        segment.segmentId === index &&
        segment.rewardType === types[index] &&
        segment.multiplier === multipliers[index] &&
        Number.isFinite(segment.probability) &&
        segment.probability >= 0 &&
        segment.probability <= 100,
    ) && Math.abs(segments.reduce((sum, segment) => sum + segment.probability, 0) - 100) < 0.001
  );
}

export function rouletteResult(spin: RouletteSpin): RouletteResult {
  const reward = ROULETTE_REWARDS[spin?.segmentId];
  if (
    !spin ||
    !reward ||
    !Number.isSafeInteger(spin.spinId) ||
    spin.spinId <= 0 ||
    !Number.isSafeInteger(spin.remaining) ||
    spin.remaining < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(spin.date) ||
    !spin.rewardVersion ||
    (spin.rewardType === 'COUPON'
      ? !('multiplier' in reward) || spin.multiplier !== reward.multiplier
      : spin.rewardType !== 'MISS' ||
        ![2, 4, 5].includes(spin.segmentId) ||
        spin.multiplier !== null)
  ) {
    throw new Error('룰렛 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.');
  }
  return {
    index: spin.segmentId,
    label: reward.label,
    won: spin.rewardType === 'COUPON',
    description:
      spin.rewardType === 'COUPON'
        ? `${spin.multiplier}배 보상 쿠폰 1장을 받았어요. 다음 선물을 보낼 때 선택할 수 있고, 만료 없이 보관돼요.`
        : '참여권 1장을 사용했어요. 다음 날 다시 도전해 주세요.',
  };
}

export function rouletteGeometry(probabilities: readonly number[]) {
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  const offset = -(probabilities[0] / total) * 180;
  let cumulative = 0;
  const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
  const sectors = probabilities.map((probability, index) => {
    const start = round(offset + (cumulative / total) * 360);
    cumulative += probability;
    const end = round(offset + (cumulative / total) * 360);
    const center = round((start + end) / 2);
    const radians = (center * Math.PI) / 180;
    return {
      index,
      start,
      end,
      center,
      width: round(end - start),
      left: 50 + 26 * Math.sin(radians),
      top: 50 - 26 * Math.cos(radians),
    };
  });
  const stops = sectors.map(
    (sector) =>
      `${sector.index % 2 === 0 ? '#fff6e8' : '#ff5d49'} ${round(sector.start - offset)}deg ${round(sector.end - offset)}deg`,
  );
  return {
    sectors,
    background: `radial-gradient(circle at 50% 45%, #ffffff00 40%, #c8442524 100%), conic-gradient(from ${offset}deg, ${stops.join(', ')})`,
  };
}

export type RouletteGeometry = ReturnType<typeof rouletteGeometry>;

export function nextRouletteRotation(from: number, index: number, geometry: RouletteGeometry) {
  const center = geometry.sectors[index].center;
  return from + 360 * 7 + ((((360 - center - (from % 360)) % 360) + 360) % 360);
}

export function rouletteBoundaryCount(rotation: number, geometry: RouletteGeometry) {
  return geometry.sectors.reduce(
    (count, sector) => count + Math.floor((rotation + sector.start) / 360),
    0,
  );
}
