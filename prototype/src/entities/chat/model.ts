export type ChatRecipient = { userId: number; name: string };
export type ChatProduct = { productId: number; reason: string };
export type ChatBlock = { type: 'text'; text: string } | { type: 'cards'; products: ChatProduct[] };
export type Turn = {
  turnId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  message: string;
  blocks: ChatBlock[];
  lastEventId: number;
  progressMessage?: string;
  error?: { message: string };
};
export type Conversation = { conversationId: string; turns: Turn[]; conversationToken: string };
export type PendingRequest = {
  turnId: string;
  body: { message: string };
  state: 'submitting' | 'unknown' | 'rejected' | 'accepted';
};
export type ChatSnapshot = {
  version: 1;
  userId: number;
  conversationId: string;
  recipient: ChatRecipient;
  token: string | null;
  turns: Turn[];
  pending: PendingRequest | null;
  draft: string;
  scrollTop: number;
};
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value);
export function isProduct(value: unknown): value is ChatProduct {
  if (!value || typeof value !== 'object') return false;
  const p = value as ChatProduct;
  return (
    Number.isSafeInteger(p.productId) &&
    p.productId > 0 &&
    typeof p.reason === 'string' &&
    !!p.reason.trim() &&
    Array.from(p.reason.trim()).length <= 200
  );
}
export function isBlock(value: unknown): value is ChatBlock {
  if (!value || typeof value !== 'object') return false;
  const b = value as ChatBlock;
  return (
    (b.type === 'text' && typeof b.text === 'string') ||
    (b.type === 'cards' &&
      Array.isArray(b.products) &&
      b.products.length > 0 &&
      b.products.length <= 3 &&
      b.products.every(isProduct))
  );
}
export function isTurn(value: unknown): value is Turn {
  if (!value || typeof value !== 'object') return false;
  const t = value as Turn;
  return (
    isUuid(t.turnId) &&
    ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status) &&
    typeof t.message === 'string' &&
    !!t.message.trim() &&
    Array.from(t.message).length <= 100 &&
    Array.isArray(t.blocks) &&
    t.blocks.every(isBlock) &&
    t.blocks.filter((b) => b.type === 'cards').length <= 1 &&
    t.blocks.every(
      (b) =>
        b.type !== 'cards' ||
        new Set(b.products.map((p) => p.productId)).size === b.products.length,
    ) &&
    Number.isSafeInteger(t.lastEventId) &&
    t.lastEventId >= 0 &&
    (t.progressMessage === undefined ||
      (t.status === 'PROCESSING' && typeof t.progressMessage === 'string')) &&
    (t.status === 'FAILED' ? typeof t.error?.message === 'string' : t.error === undefined)
  );
}
export function validateTurn(value: unknown, id: string): Turn {
  if (!isTurn(value) || value.turnId !== id) throw new Error('질문 상태를 다시 확인해 주세요.');
  return value;
}
