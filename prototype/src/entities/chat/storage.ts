import { type ChatSnapshot, isTurn, isUuid } from './model';
const PREFIX = 'gift-chat:';
export const chatStorageKey = (userId: number) => `${PREFIX}v1:${userId}`;
export function loadChat(userId: number): ChatSnapshot | null {
  const key = chatStorageKey(userId);
  try {
    for (const stored of Object.keys(sessionStorage)) {
      if (stored.startsWith(PREFIX) && stored !== key) sessionStorage.removeItem(stored);
    }
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as ChatSnapshot;
    const pending = s.pending;
    if (
      s.version !== 1 ||
      s.userId !== userId ||
      !isUuid(s.conversationId) ||
      !Number.isSafeInteger(s.recipient?.userId) ||
      s.recipient.userId < 1 ||
      typeof s.recipient.name !== 'string' ||
      !(s.token === null || typeof s.token === 'string') ||
      !Array.isArray(s.turns) ||
      !s.turns.every(isTurn) ||
      new Set(s.turns.map((t) => t.turnId)).size !== s.turns.length ||
      s.turns.filter((t) => t.status === 'PROCESSING').length > 1 ||
      (pending?.state === 'accepted' &&
        !s.turns.some(
          (t) =>
            t.turnId === pending.turnId &&
            t.status === 'PROCESSING' &&
            t.message === pending.body?.message,
        )) ||
      typeof s.draft !== 'string' ||
      Array.from(s.draft).length > 100 ||
      !Number.isFinite(s.scrollTop) ||
      s.scrollTop < 0 ||
      (pending !== null &&
        (!isUuid(pending?.turnId) ||
          typeof pending.body?.message !== 'string' ||
          !pending.body.message.trim() ||
          Array.from(pending.body.message).length > 100 ||
          !['submitting', 'unknown', 'rejected', 'accepted'].includes(pending.state)))
    )
      throw new Error('invalid snapshot');
    if (pending?.state === 'submitting') pending.state = 'unknown';
    return s;
  } catch {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Storage may be disabled. */
    }
    return null;
  }
}
export function saveChat(snapshot: ChatSnapshot) {
  try {
    sessionStorage.setItem(chatStorageKey(snapshot.userId), JSON.stringify(snapshot));
  } catch {
    /* Keep the in-memory conversation usable. */
  }
}
export function newChat(userId: number, recipient: ChatSnapshot['recipient']): ChatSnapshot {
  return {
    version: 1,
    userId,
    recipient,
    conversationId: crypto.randomUUID(),
    token: null,
    turns: [],
    pending: null,
    draft: '',
    scrollTop: 0,
  };
}
