import { apiGet, apiPost, apiPostWithHeaders } from '../../shared/api/client';
import { getSessionVersion } from '../../shared/api/session';
import type { RouletteAttendance, RouletteSpin, RouletteStatus } from './model';

let attendanceRequest: { version: number; promise: Promise<RouletteAttendance> } | null = null;

export function attendRoulette(): Promise<RouletteAttendance> {
  const version = getSessionVersion();
  if (attendanceRequest?.version === version) return attendanceRequest.promise;
  const promise = apiPost<RouletteAttendance>('/roulette/attendance').finally(() => {
    if (attendanceRequest?.promise === promise) attendanceRequest = null;
  });
  attendanceRequest = { version, promise };
  return promise;
}

export function fetchRouletteStatus() {
  return apiGet<RouletteStatus>('/roulette');
}

export function spinRoulette(key: string, signal: AbortSignal) {
  return apiPostWithHeaders<RouletteSpin>(
    '/roulette/spins',
    undefined,
    {
      'Idempotency-Key': key,
    },
    { allowRefresh: true, signal },
  );
}
