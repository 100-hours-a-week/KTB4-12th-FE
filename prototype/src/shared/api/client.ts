const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';

export async function apiGet<T>(
  path: string,
  params: Record<string, string | undefined> = {},
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const accessToken = window.localStorage.getItem('accessToken');
  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message ?? '데이터를 불러오지 못했습니다.');
  return body.data as T;
}
