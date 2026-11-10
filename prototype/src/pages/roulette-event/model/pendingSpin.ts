const PREFIX = 'roulette-pending-spin:v1:';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPendingSpin(userId: number): string | null {
  const key = sessionStorage.getItem(`${PREFIX}${userId}`);
  if (key !== null && !UUID_PATTERN.test(key)) {
    throw new Error('이전 룰렛 요청을 확인할 수 없어요. 다시 로그인한 뒤 확인해 주세요.');
  }
  return key;
}

export function prepareSpin(userId: number) {
  const key = readPendingSpin(userId) ?? crypto.randomUUID();
  // 응답 유실·화면 이동·새로고침 후에도 같은 요청을 복구할 수 있어야 전송한다.
  sessionStorage.setItem(`${PREFIX}${userId}`, key);
  return key;
}

export function clearPendingSpin(userId: number) {
  sessionStorage.removeItem(`${PREFIX}${userId}`);
}
