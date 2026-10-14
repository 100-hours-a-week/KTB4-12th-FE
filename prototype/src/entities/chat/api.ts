import { apiGet, apiPut, apiStream, USE_MOCK_API } from '../../shared/api/client';
import { mockChatRequest, mockChatStream } from './mock';
import { type ChatSnapshot, type Conversation, type Turn, validateTurn } from './model';
const path = (s: ChatSnapshot) => `/recommendations/conversations/${s.conversationId}`;
const options = (s: ChatSnapshot, signal: AbortSignal) => ({
  headers: { 'X-Conversation-Token': s.token ?? '' },
  signal,
});
export async function recoverConversation(
  s: ChatSnapshot,
  signal: AbortSignal,
): Promise<Conversation> {
  const result = USE_MOCK_API
    ? await mockChatRequest(s, 'recover', signal)
    : await apiPut<Conversation>(path(s), { recipientUserId: s.recipient.userId }, { signal });
  const c = result as Conversation;
  if (
    c?.conversationId !== s.conversationId ||
    typeof c.conversationToken !== 'string' ||
    !c.conversationToken ||
    !Array.isArray(c.turns)
  )
    throw new Error('대화 응답을 확인할 수 없습니다.');
  c.turns.forEach((t) => validateTurn(t, t.turnId));
  if (new Set(c.turns.map((t) => t.turnId)).size !== c.turns.length)
    throw new Error('중복 질문입니다.');
  return c;
}
export async function requestTurn(
  s: ChatSnapshot,
  action: 'submit' | 'get' | 'cancel',
  turnId: string,
  signal: AbortSignal,
): Promise<Turn> {
  const url = `${path(s)}/turns/${turnId}`;
  const result = USE_MOCK_API
    ? await mockChatRequest(s, action, signal, turnId)
    : action === 'get'
      ? await apiGet<Turn>(url, {}, options(s, signal))
      : await apiPut<Turn>(
          action === 'cancel' ? `${url}/cancellation` : url,
          action === 'submit' ? s.pending?.body : undefined,
          { ...options(s, signal), omitBody: action === 'cancel' },
        );
  return validateTurn(result, turnId);
}
export async function openChatStream(
  s: ChatSnapshot,
  turn: Turn,
  signal: AbortSignal,
): Promise<Response> {
  if (USE_MOCK_API) return mockChatStream(s, turn, signal);
  const response = await apiStream(
    `${path(s)}/turns/${turn.turnId}/events`,
    { afterEventId: String(turn.lastEventId) },
    options(s, signal),
  );
  if (!response.headers.get('Content-Type')?.startsWith('text/event-stream') || !response.body)
    throw new Error('스트림 응답을 확인할 수 없습니다.');
  return response;
}
