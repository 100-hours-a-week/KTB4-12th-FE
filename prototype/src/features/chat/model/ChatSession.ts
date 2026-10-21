import {
  applyChatEvent,
  type ChatRecipient,
  type ChatSnapshot,
  loadChat,
  newChat,
  openChatStream,
  recoverConversation,
  requestTurn,
  saveChat,
  SseParser,
  type Turn,
} from '../../../entities/chat';
import { ApiError } from '../../../shared/api/client';
import { getSessionVersion, loadSession } from '../../../shared/api/session';

type View = { snapshot: ChatSnapshot; busy: boolean; notice: string | null };
const missing = (error: unknown) => error instanceof ApiError && error.code === 'NOT_FOUND';
const message = (error: unknown) =>
  error instanceof Error ? error.message : '인터넷 연결을 확인하고 다시 시도해 주세요.';

export class ChatSession {
  private view: View;
  private listeners = new Set<() => void>();
  private active = false;
  private version = getSessionVersion();
  private operation: AbortController | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(userId: number, recipient: ChatRecipient) {
    const stored = loadChat(userId);
    this.view = {
      snapshot:
        stored && stored.recipient.userId === recipient.userId
          ? stored
          : newChat(userId, recipient),
      busy: false,
      notice: null,
    };
  }
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private get s() {
    return this.view.snapshot;
  }
  private live(signal?: AbortSignal) {
    const user = loadSession()?.user;
    return (
      this.active &&
      this.version === getSessionVersion() &&
      (!user || user.userId === this.s.userId) &&
      !signal?.aborted
    );
  }
  private update(snapshot: ChatSnapshot, immediate = false, notice = this.view.notice) {
    if (!this.live()) return;
    this.view = { ...this.view, snapshot, notice };
    this.listeners.forEach((l) => l());
    if (immediate) this.flush();
    else if (!this.saveTimer) this.saveTimer = setTimeout(() => this.flush(), 400);
  }
  private status(busy: boolean, notice = this.view.notice) {
    if (!this.live()) return;
    this.view = { ...this.view, busy, notice };
    this.listeners.forEach((l) => l());
  }
  flush = () => {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    if (this.live()) saveChat(this.s);
  };
  setDraft = (draft: string) =>
    this.update({ ...this.s, draft: Array.from(draft).slice(0, 100).join('') });
  setScroll = (scrollTop: number) => {
    if (!this.live()) return;
    this.view = { ...this.view, snapshot: { ...this.s, scrollTop } };
    if (!this.saveTimer) this.saveTimer = setTimeout(() => this.flush(), 400);
  };
  start = () => {
    this.active = true;
    this.version = getSessionVersion();
    window.addEventListener('online', this.onOnline);
    window.addEventListener('pagehide', this.flush);
    this.flush();
    const pending = this.s.pending;
    if (pending && pending.state !== 'rejected') void this.check();
    else if (this.s.turns.some((t) => t.status === 'PROCESSING')) void this.check();
    return this.dispose;
  };
  dispose = () => {
    this.operation?.abort();
    this.operation = null;
    this.status(false);
    if (this.s.pending?.state === 'submitting')
      this.update({ ...this.s, pending: { ...this.s.pending, state: 'unknown' } }, true);
    this.flush();
    this.active = false;
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('pagehide', this.flush);
  };
  private onOnline = () => {
    if (!this.view.busy && (this.s.pending || this.s.turns.some((t) => t.status === 'PROCESSING')))
      void this.check();
  };
  private async run(work: (signal: AbortSignal) => Promise<void>) {
    if (!this.live() || this.view.busy) return;
    const controller = new AbortController();
    this.operation = controller;
    this.status(true, null);
    try {
      await work(controller.signal);
    } catch (error) {
      if (this.live(controller.signal)) this.status(false, message(error));
    } finally {
      if (this.operation === controller) {
        this.operation = null;
        if (this.live()) this.status(false);
      }
    }
  }
  private withTimeout(signal: AbortSignal, ms: number) {
    return AbortSignal.any([signal, AbortSignal.timeout(ms)]);
  }
  private replace(turn: Turn, accepted = true) {
    const turns = [...this.s.turns];
    const index = turns.findIndex((t) => t.turnId === turn.turnId);
    if (index < 0) turns.push(turn);
    else turns[index] = turn;
    const pending = this.s.pending?.turnId === turn.turnId ? this.s.pending : null;
    this.update(
      {
        ...this.s,
        turns,
        draft:
          accepted && pending && this.s.draft.trim() === pending.body.message ? '' : this.s.draft,
        pending: pending
          ? turn.status === 'PROCESSING'
            ? { ...pending, state: 'accepted' }
            : null
          : this.s.pending,
      },
      accepted || turn.status !== 'PROCESSING',
    );
  }
  private async recover(signal: AbortSignal): Promise<boolean> {
    const result = await recoverConversation(this.s, this.withTimeout(signal, 15_000));
    if (!this.live(signal)) return false;
    const acceptedIds = this.s.turns.map((t) => t.turnId);
    if (acceptedIds.some((id) => !result.turns.some((t) => t.turnId === id))) {
      const draft = this.s.draft || this.s.pending?.body.message || '';
      this.update(
        { ...newChat(this.s.userId, this.s.recipient), draft },
        true,
        'AI 서버에 기존 대화가 없어 새 대화를 시작합니다. 질문을 다시 보내주세요.',
      );
      return false;
    }
    const pending = this.s.pending;
    const recoveredTurn = result.turns.find((t) => t.turnId === pending?.turnId);
    this.update(
      {
        ...this.s,
        token: result.conversationToken,
        turns: result.turns,
        pending:
          pending && recoveredTurn
            ? recoveredTurn.status === 'PROCESSING'
              ? { ...pending, state: 'accepted' }
              : null
            : pending,
        draft:
          pending && recoveredTurn && this.s.draft.trim() === pending.body.message
            ? ''
            : this.s.draft,
      },
      true,
    );
    return true;
  }
  private async get(turnId: string, signal: AbortSignal): Promise<Turn | null> {
    try {
      return await requestTurn(this.s, 'get', turnId, this.withTimeout(signal, 15_000));
    } catch (error) {
      if (!missing(error)) throw error;
      // A 404 also hides token expiry: reauthenticate the same UUID before concluding absence.
      if (!(await this.recover(signal))) return null;
      try {
        return await requestTurn(this.s, 'get', turnId, this.withTimeout(signal, 15_000));
      } catch (second) {
        if (!missing(second)) throw second;
        if (this.s.pending?.turnId === turnId && this.s.pending.state !== 'accepted') {
          this.update(
            { ...this.s, pending: { ...this.s.pending, state: 'rejected' } },
            true,
            '질문이 접수되지 않았습니다. 같은 질문을 다시 보낼 수 있어요.',
          );
          return null;
        }
        throw second;
      }
    }
  }
  send = async () => {
    if (
      !this.s.draft.trim() ||
      Array.from(this.s.draft).length > 100 ||
      this.s.turns.some((t) => t.status === 'PROCESSING') ||
      (this.s.pending && this.s.pending.state !== 'rejected')
    )
      return;
    const body = { message: this.s.draft.trim() };
    const previous = this.s.pending;
    const pending =
      previous?.state === 'rejected' && previous.body.message === body.message
        ? { ...previous, state: 'submitting' as const }
        : { turnId: crypto.randomUUID(), body, state: 'submitting' as const };
    await this.submit(pending);
  };
  retry = async () => {
    if (
      this.s.pending?.state === 'rejected' &&
      !this.s.turns.some((t) => t.status === 'PROCESSING')
    )
      await this.submit({ ...this.s.pending, state: 'submitting' });
    else await this.check();
  };
  private async submit(pending: NonNullable<ChatSnapshot['pending']>) {
    await this.run(async (signal) => {
      this.update({ ...this.s, pending }, true);
      // No turn PUT has been issued if creation/recovery fails.
      try {
        if (!(await this.recover(signal))) return;
      } catch (error) {
        if (this.live(signal))
          this.update({ ...this.s, pending: { ...pending, state: 'rejected' } }, true);
        throw error;
      }
      if (!this.live(signal)) return;
      const alreadyAccepted = this.s.turns.find((t) => t.turnId === pending.turnId);
      if (alreadyAccepted) {
        this.replace(alreadyAccepted);
        if (alreadyAccepted.status === 'PROCESSING') await this.stream(alreadyAccepted, signal);
        return;
      }
      const processing = this.s.turns.find((t) => t.status === 'PROCESSING');
      if (processing) {
        this.update(
          { ...this.s, pending: { ...pending, state: 'rejected' } },
          true,
          '이전 질문의 답변을 먼저 확인해 주세요.',
        );
        await this.stream(processing, signal);
        return;
      }
      let turn: Turn;
      try {
        turn = await requestTurn(
          this.s,
          'submit',
          pending.turnId,
          this.withTimeout(signal, 15_000),
        );
      } catch (error) {
        if (!this.live(signal)) return;
        const uncertain =
          !(error instanceof ApiError) ||
          error.status >= 500 ||
          error.status === 409 ||
          missing(error);
        this.update(
          { ...this.s, pending: { ...pending, state: uncertain ? 'unknown' : 'rejected' } },
          true,
          uncertain ? '접수 여부 확인 필요' : message(error),
        );
        if (!uncertain) return;
        const found = await this.get(pending.turnId, signal);
        if (found && this.live(signal)) {
          this.replace(found);
          if (found.status === 'PROCESSING') await this.stream(found, signal);
        }
        return;
      }
      if (!this.live(signal)) return;
      this.replace(turn);
      this.status(true, '질문을 접수했습니다.');
      if (turn.status === 'PROCESSING') await this.stream(turn, signal);
    });
  }
  check = async () => {
    await this.run(async (signal) => {
      const id =
        this.s.turns.find((t) => t.status === 'PROCESSING')?.turnId ?? this.s.pending?.turnId;
      if (!id) return;
      const turn = await this.get(id, signal);
      if (!turn || !this.live(signal)) return;
      this.replace(turn);
      if (turn.status === 'PROCESSING') await this.stream(turn, signal);
    });
  };
  private async stream(initial: Turn, signal: AbortSignal) {
    let turn = initial;
    // Each broken transport first reads the authoritative turn. A second failure exposes a manual retry.
    for (let attempt = 0; attempt < 2 && turn.status === 'PROCESSING'; attempt++) {
      const connection = new AbortController();
      const streamSignal = AbortSignal.any([signal, connection.signal]);
      let idle: ReturnType<typeof setTimeout> | undefined;
      const touch = () => {
        clearTimeout(idle);
        idle = setTimeout(
          () => connection.abort(new Error('응답 연결이 지연되어 상태를 확인합니다.')),
          60_000,
        );
      };
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        touch();
        const response = await openChatStream(this.s, turn, streamSignal);
        if (!this.live(signal)) return;
        reader = response.body!.getReader();
        const parser = new SseParser((event) => {
          if (!this.live(streamSignal)) return;
          turn = applyChatEvent(turn, event);
          this.replace(turn, false);
        });
        while (turn.status === 'PROCESSING') {
          const chunk = await reader.read();
          if (!this.live(signal)) return;
          if (chunk.done) {
            parser.finish();
            break;
          }
          touch();
          parser.push(chunk.value);
        }
      } catch (error) {
        if (!this.live(signal)) return;
        this.status(true, message(error));
      } finally {
        clearTimeout(idle);
        connection.abort();
        await reader?.cancel().catch(() => undefined);
        reader?.releaseLock();
      }
      if (!this.live(signal) || turn.status !== 'PROCESSING') return;
      const synced = await this.get(turn.turnId, signal);
      if (!synced || !this.live(signal)) return;
      turn = synced;
      this.replace(turn);
    }
    if (turn.status === 'PROCESSING')
      this.status(false, '연결이 끊겼어요. 상태 확인을 눌러 대화를 이어가세요.');
  }
  cancel = async () => {
    const id = this.s.turns.find((t) => t.status === 'PROCESSING')?.turnId;
    if (!id || !this.live()) return;
    const old = this.operation;
    this.operation = null;
    old?.abort();
    this.status(false);
    await this.run(async (signal) => {
      let turn: Turn;
      try {
        turn = await requestTurn(this.s, 'cancel', id, this.withTimeout(signal, 15_000));
      } catch (error) {
        if (!this.live(signal)) return;
        const synced = await this.get(id, signal);
        if (!synced || !this.live(signal)) return;
        this.replace(synced);
        // A token rejection can be retried after reauthentication; lost responses are read-only recovery.
        if (missing(error) && synced.status === 'PROCESSING') {
          turn = await requestTurn(this.s, 'cancel', id, this.withTimeout(signal, 15_000));
        } else {
          if (synced.status !== 'PROCESSING') return;
          throw error;
        }
      }
      if (!this.live(signal)) return;
      this.replace(turn);
      this.status(
        true,
        turn.status === 'CANCELLED' ? '답변 생성을 중지했습니다.' : '질문 상태를 조회했습니다.',
      );
      if (turn.status === 'PROCESSING') await this.stream(turn, signal);
    });
  };
}
