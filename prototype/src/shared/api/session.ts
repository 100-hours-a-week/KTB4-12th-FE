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
let sessionVersion = 0;

export function getSessionVersion() {
  return sessionVersion;
}

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

let sessionUserId = loadSession()?.user?.userId ?? null;

export function saveSession(data: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  user?: SessionUser;
}) {
  sessionVersion += 1;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  if (data.expiresIn != null) {
    window.localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + data.expiresIn * 1000));
  }
  if (data.user) window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  window.localStorage.setItem(AUTH_FLAG_KEY, 'signed-in');
  sessionUserId = loadSession()?.user?.userId ?? null;
}

export function updateSessionTokens(
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number,
) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  window.localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + expiresIn * 1000));
}

export function clearSession() {
  sessionVersion += 1;
  sessionUserId = null;
  // 세션이 아니어도 남아있던 프로토타입 캐시(선호도, mock 프로필 등)까지
  // 다음 로그인 사용자에게 새어나가지 않도록 스토리지를 전부 비운다.
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem(AUTH_FLAG_KEY, 'signed-out');
}

// Other tabs can change the shared login while this tab still has a live chat stream.
window.addEventListener('storage', (event) => {
  if (
    event.storageArea !== window.localStorage ||
    (event.key !== null &&
      event.key !== USER_KEY &&
      event.key !== ACCESS_TOKEN_KEY &&
      event.key !== AUTH_FLAG_KEY)
  )
    return;
  const nextUserId = loadSession()?.user?.userId ?? null;
  if (
    event.key === ACCESS_TOKEN_KEY &&
    event.oldValue &&
    event.newValue &&
    sessionUserId !== null &&
    sessionUserId === nextUserId
  )
    return;
  sessionUserId = nextUserId;
  sessionVersion += 1;
  window.dispatchEvent(new Event('prototype:session-changed'));
});
