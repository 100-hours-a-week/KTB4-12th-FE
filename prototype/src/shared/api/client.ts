import { clearSession, getSessionVersion, loadSession, updateSessionTokens } from './session';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';

export type ApiErrorDetails = Array<{ field: string; reason: string }>;

export class ApiError extends Error {
  status: number;
  code: string | null;
  details: ApiErrorDetails | null;
  traceId: string | null;
  retryAfterSeconds: number | null = null;

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

async function fetchResponse(url: URL, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (cause) {
    // Navigation and explicit cancellation must keep their abort semantics.
    if (options.signal?.aborted || (cause instanceof Error && cause.name === 'AbortError'))
      throw cause;
    const error = new ApiError(
      '서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',
      0,
      {
        code: 'NETWORK_ERROR',
      },
    );
    error.cause = cause;
    throw error;
  }
}

// refresh token은 HttpOnly 쿠키(Path=/auth)로만 오가므로 credentials를 포함해 호출한다.
// 응답 body에 refreshToken이 오는 서버라면 함께 갱신한다.
async function refreshAccessToken(version: number, signal?: AbortSignal): Promise<string | null> {
  const session = loadSession();
  if (!session) return null;
  const response = await fetchResponse(buildUrl('/auth/refresh'), {
    signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(session.refreshToken ? { refreshToken: session.refreshToken } : {}),
  });
  const body = await parseBody<{ accessToken: string; refreshToken?: string; expiresIn: number }>(
    response,
  );
  if (version !== getSessionVersion()) return null;
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

async function requestResponse(
  method: string,
  path: string,
  body?: unknown,
  params: Record<string, string | undefined> = {},
  extraHeaders: Record<string, string> = {},
  allowRefresh = true,
  authenticated = true,
  signal?: AbortSignal,
): Promise<Response> {
  const version = getSessionVersion();
  const session = authenticated ? loadSession() : null;
  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  const response = await fetchResponse(buildUrl(path, params), {
    method,
    signal,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const responseBody = response.ok ? {} : await parseBody<never>(response);

  if (authenticated && version !== getSessionVersion())
    throw new ApiError('로그인 계정이 변경되어 이전 요청을 취소했습니다.', 0, {
      code: 'SESSION_CHANGED',
    });

  // UNAUTHORIZED는 "로그인이 필요합니다" (세션이 아예 없거나 서버가 인증을 거부한 경우) 전용 코드다.
  // 로그인 실패(INVALID_CREDENTIALS) 등 다른 401은 호출부에서 직접 처리하므로 여기서 건드리지 않는다.
  if (authenticated && response.status === 401 && responseBody.error?.code === 'UNAUTHORIZED') {
    if (allowRefresh && session) {
      const currentSession = loadSession();
      const newToken =
        session.user &&
        currentSession?.user?.userId === session.user.userId &&
        currentSession.accessToken !== session.accessToken
          ? currentSession.accessToken
          : isSessionExpired(session)
            ? await refreshAccessToken(version, signal)
            : null;
      if (version !== getSessionVersion())
        throw new ApiError('로그인 계정이 변경되어 이전 요청을 취소했습니다.', 0, {
          code: 'SESSION_CHANGED',
        });
      if (newToken)
        return requestResponse(
          method,
          path,
          body,
          params,
          extraHeaders,
          false,
          authenticated,
          signal,
        );
    }
    // 원래 세션이 있었을 때만 "만료됨" 토스트를 띄운다. 애초에 로그인한 적이 없는
    // 상태(예: 로그인 화면에서 인증이 필요한 백그라운드 요청이 401을 받는 경우)까지
    // "세션이 만료됐다"고 안내하면 잘못된 메시지가 된다.
    const hadSession = Boolean(session?.accessToken);
    clearSession();
    clearRefreshCookie();
    window.dispatchEvent(new CustomEvent('prototype:session-expired', { detail: { hadSession } }));
  }

  if (!response.ok) {
    if (response.status === 500 && responseBody.error?.traceId)
      console.error('API 오류 traceId:', responseBody.error.traceId);
    const error = new ApiError(
      responseBody.message ?? '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
      response.status,
      responseBody.error,
    );
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter && /^\d+$/.test(retryAfter)) error.retryAfterSeconds = Number(retryAfter);
    throw error;
  }
  return response;
}

type RequestOptions = {
  authenticated?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params: Record<string, string | undefined> = {},
  extraHeaders: Record<string, string> = {},
  allowRefresh = true,
  authenticated = true,
  signal?: AbortSignal,
): Promise<T> {
  const version = getSessionVersion();
  const response = await requestResponse(
    method,
    path,
    body,
    params,
    extraHeaders,
    allowRefresh,
    authenticated,
    signal,
  );
  const parsed = await parseBody<T>(response);
  if (authenticated && version !== getSessionVersion())
    throw new ApiError('로그인 계정이 변경되어 이전 요청을 취소했습니다.', 0, {
      code: 'SESSION_CHANGED',
    });
  signal?.throwIfAborted();
  return parsed.data as T;
}

export function apiStream(
  path: string,
  params: Record<string, string>,
  options: RequestOptions,
): Promise<Response> {
  return requestResponse(
    'GET',
    path,
    undefined,
    params,
    { Accept: 'text/event-stream', ...options.headers },
    true,
    true,
    options.signal,
  );
}

export function apiGet<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  options: RequestOptions = {},
): Promise<T> {
  return request<T>(
    'GET',
    path,
    undefined,
    params,
    options.headers,
    true,
    options.authenticated ?? true,
    options.signal,
  );
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options: { authenticated?: boolean } = {},
): Promise<T> {
  return request<T>('POST', path, body ?? {}, {}, {}, true, options.authenticated ?? true);
}

export function apiPut<T>(
  path: string,
  body?: unknown,
  options: RequestOptions & { omitBody?: boolean } = {},
): Promise<T> {
  return request<T>(
    'PUT',
    path,
    options.omitBody ? undefined : (body ?? {}),
    {},
    options.headers,
    true,
    true,
    options.signal,
  );
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
