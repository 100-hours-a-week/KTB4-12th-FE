import { isProduct, type Turn, validateTurn } from './model';

export type ChatEvent = { id: number; event: string; data: string };

// Keep the decoder, line and event buffers across reads, including split CRLF and UTF-8.
export class SseParser {
  private decoder = new TextDecoder('utf-8', { fatal: true });
  private buffer = '';
  private fields: string[] = [];
  constructor(private emit: (event: ChatEvent) => void) {}
  push(chunk: Uint8Array) {
    this.consume(this.decoder.decode(chunk, { stream: true }));
  }
  finish() {
    this.consume(this.decoder.decode());
    if (this.buffer || this.fields.length) throw new Error('불완전한 이벤트입니다.');
  }
  private consume(text: string) {
    this.buffer += text;
    while (true) {
      const index = this.buffer.search(/[\r\n]/);
      if (index < 0 || (this.buffer[index] === '\r' && index === this.buffer.length - 1)) return;
      const line = this.buffer.slice(0, index);
      const length = this.buffer[index] === '\r' && this.buffer[index + 1] === '\n' ? 2 : 1;
      this.buffer = this.buffer.slice(index + length);
      if (line.startsWith(':')) continue;
      if (line) {
        this.fields.push(line);
        continue;
      }
      if (!this.fields.length) continue;
      let id = '',
        event = '';
      const data: string[] = [];
      for (const field of this.fields) {
        const colon = field.indexOf(':');
        const key = colon < 0 ? field : field.slice(0, colon);
        const value = colon < 0 ? '' : field.slice(colon + 1).replace(/^ /, '');
        if (key === 'id') id = value;
        if (key === 'event') event = value;
        if (key === 'data') data.push(value);
      }
      this.fields = [];
      if (!data.length) continue;
      if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1)
        throw new Error('이벤트 번호를 확인할 수 없습니다.');
      this.emit({ id: Number(id), event, data: data.join('\n') });
    }
  }
}

export function applyChatEvent(turn: Turn, event: ChatEvent): Turn {
  if (event.id <= turn.lastEventId) return turn;
  if (event.id !== turn.lastEventId + 1) throw new Error('이벤트가 누락되었습니다.');
  if (turn.status !== 'PROCESSING') throw new Error('종료된 질문에 이벤트가 추가되었습니다.');
  const value = JSON.parse(event.data);
  if (event.event === 'turn.finished') {
    const final = validateTurn(value, turn.turnId);
    if (final.status === 'PROCESSING' || final.lastEventId !== event.id)
      throw new Error('종료 상태가 올바르지 않습니다.');
    return final;
  }
  const next: Turn = { ...turn, blocks: [...turn.blocks], lastEventId: event.id };
  if (event.event === 'progress' && typeof value?.message === 'string')
    next.progressMessage = value.message;
  else if (event.event === 'answer.delta' && typeof value?.delta === 'string') {
    delete next.progressMessage;
    const last = next.blocks.at(-1);
    if (last?.type === 'text')
      next.blocks[next.blocks.length - 1] = { type: 'text', text: last.text + value.delta };
    else next.blocks.push({ type: 'text', text: value.delta });
  } else if (
    event.event === 'cards' &&
    Array.isArray(value?.products) &&
    value.products.length > 0 &&
    value.products.length <= 3 &&
    value.products.every(isProduct)
  ) {
    if (
      next.blocks.some((b) => b.type === 'cards') ||
      new Set(value.products.map((p: { productId: number }) => p.productId)).size !==
        value.products.length
    )
      throw new Error('카드가 중복되었습니다.');
    next.blocks.push({ type: 'cards', products: value.products });
  } else throw new Error('이벤트 형식이 올바르지 않습니다.');
  return next;
}
