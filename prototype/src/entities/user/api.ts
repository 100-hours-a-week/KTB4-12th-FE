import { apiGet, apiPatch, USE_MOCK_API } from '../../shared/api/client';
import type { MyProfile, SearchedUser } from './model';

function delay(ms = 240) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const MOCK_PROFILE: MyProfile = {
  userId: 1,
  name: '홍길동',
  email: 'email@email.com',
  birth: '2000-01-01',
  isBirthdayPublic: false,
  giftSummary: {
    sentCount: 12,
    receivedCount: 8,
    period: { from: '2026-01-01T00:00:00+09:00', to: '2026-09-03T23:59:59+09:00' },
  },
};

function readMockProfile(): MyProfile {
  const raw = window.localStorage.getItem('mock-profile');
  return raw ? { ...MOCK_PROFILE, ...(JSON.parse(raw) as Partial<MyProfile>) } : MOCK_PROFILE;
}

export async function fetchMe(): Promise<MyProfile> {
  if (USE_MOCK_API) {
    await delay();
    return readMockProfile();
  }
  return apiGet<MyProfile>('/users/me');
}

export async function updateMe(patch: {
  birth?: string;
  isBirthdayPublic?: boolean;
}): Promise<{ birth: string; isBirthdayPublic: boolean; updatedAt: string }> {
  if (USE_MOCK_API) {
    await delay(300);
    const current = readMockProfile();
    const next: MyProfile = { ...current, ...patch };
    window.localStorage.setItem('mock-profile', JSON.stringify(next));
    return {
      birth: next.birth,
      isBirthdayPublic: next.isBirthdayPublic,
      updatedAt: new Date().toISOString(),
    };
  }
  return apiPatch('/users/me', patch);
}

export async function completeOnboarding(): Promise<{ isFirstLogin: boolean }> {
  if (USE_MOCK_API) {
    await delay(200);
    return { isFirstLogin: false };
  }
  return apiPatch('/users/me/onboarding', { completed: true });
}

export async function searchUserByEmail(email: string): Promise<SearchedUser | null> {
  if (USE_MOCK_API) {
    await delay(300);
    const found = searchFriendsMock.find(
      (friend) => friend.email.toLowerCase() === email.trim().toLowerCase(),
    );
    return found ?? null;
  }
  const data = await apiGet<{ user: SearchedUser | null }>('/users/search', {
    email: email.trim(),
  });
  return data.user;
}

// 목업용 친구 추가 대상 (features/add-friend의 기존 목업 데이터와 동일)
const searchFriendsMock = [
  { userId: 27, name: '김민정', email: 'kakaa@kakao.co.kr' },
  { userId: 31, name: '김민주', email: 'kakaminjoo@kakao.co.kr' },
  { userId: 33, name: '박민지', email: 'kakapark@kakao.co.kr' },
  { userId: 30, name: '김우주', email: 'kakawoojoo@kakao.co.kr' },
];
