import { clearSession, loadSession, updateSessionTokens } from './session';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';

export type ApiErrorDetails = Array<{ field: string; reason: string }>;

export class ApiError extends Error {
  status: number;
  code: string | null;
  details: ApiErrorDetails | null;
  traceId: string | null;

  constructor(
    message: string,
    status: number,
    error?: { code?: string; traceId?: string; details?: ApiErrorDetails },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = error?.code ?? null;
    this.details = error?.details ?? null;
    this.traceId = error?.traceId ?? null;
  }
}

type ApiResponse<T> = {
  message?: string;
  data?: T;
  error?: { code?: string; traceId?: string; details?: ApiErrorDetails };
};

function buildUrl(path: string, params: Record<string, string | undefined> = {}) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url;
}

function isSessionExpired(session: { accessTokenExpiresAt: number | null }) {
  return (
    session.accessTokenExpiresAt != null && session.accessTokenExpiresAt <= Date.now() + 30_000
  );
}

async function parseBody<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return {};
  }
}

// refresh token은 HttpOnly 쿠키(Path=/auth)로만 오가므로 credentials를 포함해 호출한다.
// 응답 body에 refreshToken이 오는 서버라면 함께 갱신한다.
async function refreshAccessToken(): Promise<string | null> {
  const session = loadSession();
  if (!session) return null;
  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(session.refreshToken ? { refreshToken: session.refreshToken } : {}),
  });
  const body = await parseBody<{ accessToken: string; refreshToken?: string; expiresIn: number }>(
    response,
  );
  if (!response.ok || !body.data) return null;
  updateSessionTokens(body.data.accessToken, body.data.refreshToken, body.data.expiresIn);
  return body.data.accessToken;
}

// refreshToken 쿠키는 HttpOnly라 JS에서 지울 수 없다. 서버가 Set-Cookie로
// 만료시켜주는 /auth/logout을 호출해야 실제로 브라우저에서 사라진다.
function clearRefreshCookie() {
  fetch(buildUrl('/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params: Record<string, string | undefined> = {},
  extraHeaders: Record<string, string> = {},
  allowRefresh = true,
): Promise<T> {
  const session = loadSession();
  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  const response = await fetch(buildUrl(path, params), {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const responseBody = await parseBody<T>(response);

  // UNAUTHORIZED는 "로그인이 필요합니다" (세션이 아예 없거나 서버가 인증을 거부한 경우) 전용 코드다.
  // 로그인 실패(INVALID_CREDENTIALS) 등 다른 401은 호출부에서 직접 처리하므로 여기서 건드리지 않는다.
  if (response.status === 401 && responseBody.error?.code === 'UNAUTHORIZED') {
    if (allowRefresh && session && isSessionExpired(session)) {
      const newToken = await refreshAccessToken();
      if (newToken) return request<T>(method, path, body, params, extraHeaders, false);
    }
    clearSession();
    clearRefreshCookie();
    window.dispatchEvent(new Event('prototype:session-expired'));
  }

  if (!response.ok) {
    throw new ApiError(
      responseBody.message ?? '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
      response.status,
      responseBody.error,
    );
  }
  return responseBody.data as T;
}

export function apiGet<T>(
  path: string,
  params: Record<string, string | undefined> = {},
): Promise<T> {
  return request<T>('GET', path, undefined, params);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body ?? {});
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body ?? {});
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body ?? {});
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

export function apiPostWithHeaders<T>(
  path: string,
  body: unknown,
  extraHeaders: Record<string, string>,
): Promise<T> {
  return request<T>('POST', path, body, {}, extraHeaders, false);
}
