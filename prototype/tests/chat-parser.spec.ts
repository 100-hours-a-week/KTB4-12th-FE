import { expect, test } from '@playwright/test';

import type { Turn } from '../src/entities/chat/model';
import { applyChatEvent, type ChatEvent, SseParser } from '../src/entities/chat/sse';
const initial: Turn = {
  turnId: '11111111-1111-4111-8111-111111111111',
  message: '추천해줘',
  status: 'PROCESSING',
  blocks: [],
  lastEventId: 0,
};
const event = (id: number, kind: string, value: unknown): ChatEvent => ({
  id,
  event: kind,
  data: JSON.stringify(value),
});

test('모든 바이트 경계와 복수 이벤트·CRLF·heartbeat를 누적 파싱한다', () => {
  const bytes = new TextEncoder().encode(
    ': keep-alive\r\n\r\nid: 1\r\nevent: answer.delta\r\ndata: {"delta":"한글 🎁"}\r\n\r\nid: 2\nevent: progress\ndata: {"message":"다음"}\n\n',
  );
  for (let cut = 0; cut <= bytes.length; cut++) {
    const events: ChatEvent[] = [];
    const parser = new SseParser((e) => events.push(e));
    parser.push(bytes.slice(0, cut));
    parser.push(bytes.slice(cut));
    parser.finish();
    expect(events).toEqual([
      event(1, 'answer.delta', { delta: '한글 🎁' }),
      event(2, 'progress', { message: '다음' }),
    ]);
  }
  const events: ChatEvent[] = [];
  const parser = new SseParser((e) => events.push(e));
  bytes.forEach((byte) => parser.push(new Uint8Array([byte])));
  parser.finish();
  expect(events).toHaveLength(2);
});

test('진행 교체·text 합치기·카드 후 text·중복 ID·최종 상태 교체', () => {
  let turn = applyChatEvent(initial, event(1, 'progress', { message: '확인' }));
  turn = applyChatEvent(turn, event(2, 'progress', { message: '검색' }));
  expect(turn.progressMessage).toBe('검색');
  turn = applyChatEvent(turn, event(3, 'answer.delta', { delta: '한글' }));
  expect(turn.progressMessage).toBeUndefined();
  turn = applyChatEvent(turn, event(4, 'answer.delta', { delta: ' 🎁' }));
  expect(applyChatEvent(turn, event(4, 'answer.delta', { delta: '중복' }))).toBe(turn);
  turn = applyChatEvent(
    turn,
    event(5, 'cards', { products: [{ productId: 101, reason: '추천' }] }),
  );
  turn = applyChatEvent(turn, event(6, 'answer.delta', { delta: '<b>텍스트</b>' }));
  expect(turn.blocks).toHaveLength(3);
  for (const status of ['COMPLETED', 'CANCELLED', 'FAILED'] as const) {
    const final = {
      ...turn,
      status,
      lastEventId: 7,
      ...(status === 'FAILED' ? { error: { message: '실패' } } : {}),
    };
    expect(applyChatEvent(turn, event(7, 'turn.finished', final))).toEqual(final);
  }
});

test('누락·형식 오류·불완전 EOF·유효하지 않은 UTF-8은 재동기화 대상으로 거부한다', () => {
  expect(() => applyChatEvent(initial, event(2, 'answer.delta', { delta: '누락' }))).toThrow();
  expect(() => applyChatEvent(initial, event(1, 'answer.delta', { delta: 3 }))).toThrow();
  const parser = new SseParser(() => {});
  parser.push(new TextEncoder().encode('id: 1\nevent: answer.delta\ndata: {"delta":"끝"}\n'));
  expect(() => parser.finish()).toThrow();
  expect(() => new SseParser(() => {}).push(new Uint8Array([255]))).toThrow();
});
