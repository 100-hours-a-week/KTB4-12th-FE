export type SessionUser = {
  userId: number;
  name: string;
  email: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number | null;
  user: SessionUser | null;
};

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const EXPIRES_AT_KEY = 'accessTokenExpiresAt';
const USER_KEY = 'authUser';
export const AUTH_FLAG_KEY = 'prototype-auth';

export function loadSession(): Session | null {
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  const expiresAtRaw = window.localStorage.getItem(EXPIRES_AT_KEY);
  const userRaw = window.localStorage.getItem(USER_KEY);
  return {
    accessToken,
    refreshToken: refreshToken ?? '',
    accessTokenExpiresAt: expiresAtRaw ? Number(expiresAtRaw) : null,
    user: userRaw ? (JSON.parse(userRaw) as SessionUser) : null,
  };
}

export function saveSession(data: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  user?: SessionUser;
}) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  if (data.expiresIn != null) {
    window.localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + data.expiresIn * 1000));
  }
  if (data.user) window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  window.localStorage.setItem(AUTH_FLAG_KEY, 'signed-in');
}

export function updateSessionTokens(accessToken: string, refreshToken: string, expiresIn: number) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  window.localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + expiresIn * 1000));
}

export function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_AT_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.setItem(AUTH_FLAG_KEY, 'signed-out');
}
