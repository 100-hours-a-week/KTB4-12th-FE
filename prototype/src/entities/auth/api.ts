import { ApiError, apiGet, apiPost, USE_MOCK_API } from '../../shared/api/client';
import { loadSession } from '../../shared/api/session';
import { type LoginResult, mockSignupTerms, type SignupRequest, type SignupTerm } from './model';

function delay(ms = 240) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function fetchSignupTerms(): Promise<SignupTerm[]> {
  if (USE_MOCK_API) {
    await delay();
    return mockSignupTerms;
  }
  const data = await apiGet<{ terms: SignupTerm[] }>('/auth/terms');
  return data.terms;
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  if (USE_MOCK_API) {
    await delay();
    return true;
  }
  const data = await apiPost<{ available: boolean }>('/auth/email-availability', { email });
  return data.available;
}

export async function signup(payload: SignupRequest): Promise<{ userId: number }> {
  if (USE_MOCK_API) {
    await delay(400);
    return { userId: 1 };
  }
  return apiPost<{ userId: number }>('/auth/signup', payload);
}

export async function login(email: string, password: string): Promise<LoginResult> {
  if (USE_MOCK_API) {
    await delay(400);
    if (!email || !password) {
      throw new ApiError('이메일 또는 비밀번호가 일치하지 않습니다.', 401, {
        code: 'INVALID_CREDENTIALS',
      });
    }
    return {
      accessToken: 'prototype-test-token',
      refreshToken: 'prototype-refresh-token',
      expiresIn: 3600,
      user: { userId: 1, name: '홍길동', email },
      isFirstLogin: false,
    };
  }
  return apiPost<LoginResult>('/auth/login', { email, password });
}

export async function logout(): Promise<void> {
  const refreshToken = loadSession()?.refreshToken;
  if (USE_MOCK_API || !refreshToken) return;
  await apiPost('/auth/logout', { refreshToken });
}
