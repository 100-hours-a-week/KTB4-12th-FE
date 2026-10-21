import { ApiError } from '../../shared/api/client';
import { type ChatSnapshot, type Conversation, type Turn } from './model';
import { applyChatEvent, type ChatEvent } from './sse';

type StoredMock = {
  started: number;
  initial: Turn;
  events: Array<ChatEvent & { at: number }>;
  cancelled?: Turn;
};
const memory = new Map<string, StoredMock[]>();
const key = (s: ChatSnapshot) => `mock-chat:${s.userId}:${s.conversationId}`;
const scenario = () => new URLSearchParams(location.search).get('chatMock') ?? 'text';
function read(s: ChatSnapshot): StoredMock[] {
  const cached = memory.get(key(s));
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(key(s));
    return raw ? JSON.parse(raw) : (memory.get(key(s)) ?? []);
  } catch {
    return memory.get(key(s)) ?? [];
  }
}
function write(s: ChatSnapshot, turns: StoredMock[]) {
  memory.set(key(s), turns);
  try {
    sessionStorage.setItem(key(s), JSON.stringify(turns));
  } catch {
    /* The mock also works without storage. */
  }
}
function current(t: StoredMock): Turn {
  if (t.cancelled) return t.cancelled;
  return t.events.filter((e) => e.at <= Date.now() - t.started).reduce(applyChatEvent, t.initial);
}
function makeTurn(id: string, message: string): StoredMock {
  const mode = scenario();
  const step = mode === 'slow' ? 2500 : mode === 'delayed_tokens' ? 5000 : 120;
  const events: StoredMock['events'] = [];
  const initial: Turn = { turnId: id, message, status: 'PROCESSING', blocks: [], lastEventId: 0 };
  const add = (event: string, data: unknown) =>
    events.push({
      id: events.length + 1,
      event,
      data: JSON.stringify(data),
      at: (events.length + 1) * step,
    });
  add('progress', { message: '선물 조건을 확인하고 있어요.' });
  const text =
    mode === 'long'
      ? '한글과 이모지 🎁 선물 이야기를 함께 나눠요. '.repeat(70)
      : '마음을 담은 선물을 추천해드릴게요. 🎁';
  for (const delta of Array.from(text.matchAll(/.{1,24}/gu), (m) => m[0]))
    add('answer.delta', { delta });
  if (mode === 'cards')
    add('cards', {
      products: [{ productId: 900000001, reason: '예산에 맞는 실용적인 선물이에요.' }],
    });
  const partial = events.reduce(applyChatEvent, initial);
  const final: Turn = {
    ...partial,
    status: mode === 'failed' ? 'FAILED' : 'COMPLETED',
    lastEventId: events.length + 1,
  };
  delete final.progressMessage;
  if (final.status === 'FAILED') final.error = { message: '답변 생성에 실패했습니다.' };
  add('turn.finished', final);
  return { started: Date.now(), initial, events };
}
export async function mockChatRequest(
  s: ChatSnapshot,
  action: 'recover' | 'submit' | 'get' | 'cancel',
  signal: AbortSignal,
  turnId?: string,
): Promise<Conversation | Turn> {
  signal.throwIfAborted();
  const turns = read(s);
  if (action === 'recover')
    return {
      conversationId: s.conversationId,
      turns: turns.map(current),
      conversationToken: 'mock-conversation-token',
    };
  let entry = turns.find((t) => t.initial.turnId === turnId);
  if (action === 'submit') {
    if (!entry) {
      if (turns.some((t) => current(t).status === 'PROCESSING'))
        throw new ApiError('질문 ID 또는 현재 대화 처리 상태가 요청과 충돌합니다.', 409, {
          code: 'CONFLICT',
        });
      entry = makeTurn(turnId!, s.pending!.body.message);
      turns.push(entry);
      write(s, turns);
      if (scenario() === 'timeout') throw new TypeError('접수 응답을 받지 못했습니다.');
    } else if (entry.initial.message !== s.pending?.body.message)
      throw new ApiError('질문 ID 또는 현재 대화 처리 상태가 요청과 충돌합니다.', 409, {
        code: 'CONFLICT',
      });
  }
  if (!entry) throw new ApiError('대화 또는 질문을 찾을 수 없습니다.', 404, { code: 'NOT_FOUND' });
  if (action === 'cancel') {
    const turn = current(entry);
    entry.cancelled = turn.status === 'PROCESSING' ? { ...turn, status: 'CANCELLED' } : turn;
    delete entry.cancelled.progressMessage;
    write(s, turns);
  }
  return current(entry);
}
const disconnected = new Set<string>();
export function mockChatStream(s: ChatSnapshot, turn: Turn, signal: AbortSignal): Response {
  const entry = read(s).find((t) => t.initial.turnId === turn.turnId);
  if (!entry) throw new Error('mock turn missing');
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const abort = () => {
        if (!closed) {
          closed = true;
          clearTimeout(timer);
          controller.error(signal.reason);
        }
        cleanup();
      };
      cleanup = () => signal.removeEventListener('abort', abort);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      const remaining = entry.events.filter((e) => e.id > turn.lastEventId);
      let index = 0;
      const send = () => {
        if (closed) return;
        if (index >= remaining.length) {
          closed = true;
          cleanup();
          controller.close();
          return;
        }
        const event = remaining[index++];
        timer = setTimeout(
          () => {
            if (closed) return;
            const bytes = encoder.encode(
              `id: ${event.id}\r\nevent: ${event.event}\r\ndata: ${event.data}\r\n\r\n`,
            );
            // Exercise split UTF-8 and event boundaries with the same production parser.
            for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
            if (scenario() === 'reconnect' && !disconnected.has(key(s))) {
              disconnected.add(key(s));
              closed = true;
              cleanup();
              controller.error(new Error('mock disconnect'));
              return;
            }
            send();
          },
          Math.max(0, entry.started + event.at - Date.now()),
        );
      };
      send();
    },
    cancel() {
      closed = true;
      clearTimeout(timer);
      cleanup();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
