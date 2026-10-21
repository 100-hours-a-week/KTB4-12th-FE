import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

import { type ChatRecipient, loadChat } from '../../../entities/chat';
import type { Product } from '../../../entities/product';
import { ChatSession } from '../../../features/chat';
import { ChatProductCards, ChatProducts } from '../../../features/chat-product-cards';
import { Carousel, KeyboardTextarea, useKeyboardInsets } from '../../../mobile';
import { SUNJALAL_BOT_IMAGE } from '../../../shared/config/assets';
import { AsyncContentState, ScreenHeader } from '../../../shared/ui';

export function AiChatPage({
  profileLoading,
  profileError,
  onRetryProfile,
  feedback,
  userId,
  recipient,
  onSelectRecipient,
  onProduct,
  onBack,
}: {
  profileLoading: boolean;
  profileError: string;
  onRetryProfile: () => void;
  feedback?: ReactNode;
  userId: number | null;
  recipient: ChatRecipient | null;
  onSelectRecipient: () => void;
  onProduct: (product: Product, recipient: ChatRecipient) => void;
  onBack: () => void;
}) {
  const [stored] = useState(() => (userId ? loadChat(userId) : null));
  const selected = recipient ?? stored?.recipient;
  if (!userId || !selected)
    return (
      <section className="page ai-chat-page">
        <ScreenHeader title="선잘알 봇" onBack={onBack} />
        <div className="sunjalal-welcome">
          <span className="sunjalal-welcome-badge">당신의 AI 선물 메이트</span>
          <img
            className="sunjalal-welcome-character"
            src={SUNJALAL_BOT_IMAGE}
            alt="선잘알 캐릭터"
            draggable={false}
          />
          <h2>
            선물 고민,
            <br />
            같이 풀어볼까요?
          </h2>
          <p>
            생일도, 새로운 시작도, 고마운 마음도.
            <br />
            마음을 전할 선물을 함께 찾아드릴게요.
          </p>
          <div className="sunjalal-welcome-occasions" aria-label="선물 추천 상황">
            <span>🎂 생일</span>
            <span>🎉 취업·승진</span>
            <span>💌 감사 인사</span>
          </div>
        </div>
        <div className="sunjalal-start-card">
          <span className="sunjalal-start-step">STEP 01</span>
          <h3>누구에게 마음을 전할까요?</h3>
          <p>
            {userId
              ? '받는 사람을 고르고, 상황과 예산을 알려주세요.'
              : profileLoading
                ? '로그인 정보를 확인하고 있어요.'
                : '로그인 정보를 확인하지 못했어요.'}
          </p>
          {!userId ? (
            <AsyncContentState
              loading={profileLoading}
              error={
                profileError ||
                (!profileLoading ? '내 정보를 불러오지 못했어요. 다시 시도해 주세요.' : '')
              }
              onRetry={onRetryProfile}
            />
          ) : null}
          <button
            type="button"
            className="primary sunjalal-start-button"
            onClick={onSelectRecipient}
            disabled={!userId}
          >
            받는 사람 선택 <span aria-hidden="true">→</span>
          </button>
        </div>
        {feedback}
        <p className="sunjalal-welcome-footnote">
          AI 추천은 참고용이에요. 상품 정보는 카드에서 확인해 주세요.
        </p>
      </section>
    );
  return (
    <ChatPage
      feedback={feedback}
      key={`${userId}:${selected.userId}`}
      userId={userId}
      recipient={selected}
      onProduct={onProduct}
      onBack={onBack}
    />
  );
}

function ChatPage({
  feedback,
  userId,
  recipient,
  onProduct,
  onBack,
}: {
  feedback?: ReactNode;
  userId: number;
  recipient: ChatRecipient;
  onProduct: (product: Product, recipient: ChatRecipient) => void;
  onBack: () => void;
}) {
  const [chat] = useState(() => new ChatSession(userId, recipient));
  const { snapshot, busy, notice } = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
  const [products] = useState(() => new ChatProducts());
  const productStates = useSyncExternalStore(products.subscribe, products.getSnapshot);
  const productIds = [
    ...new Set(
      snapshot.turns.flatMap((turn) =>
        turn.blocks.flatMap((block) =>
          block.type === 'cards' ? block.products.map((product) => product.productId) : [],
        ),
      ),
    ),
  ].join(',');
  useEffect(() => products.start(), [products]);
  useEffect(() => {
    products.ensure(productIds ? productIds.split(',').map(Number) : []);
  }, [products, productIds]);
  const viewProduct = (product: Product) => {
    chat.setScroll(scrollRef.current?.scrollTop ?? snapshot.scrollTop);
    chat.flush();
    onProduct(product, snapshot.recipient);
  };
  const { bottomInset } = useKeyboardInsets();
  const [host, setHost] = useState<Element | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [controlsHeight, setControlsHeight] = useState(240);
  const pageRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const restoring = useRef(true);
  const follow = useRef(false);
  const bindPage = useCallback((node: HTMLElement | null) => {
    pageRef.current = node;
    setHost(node?.closest('.gift-app') ?? null);
  }, []);
  useEffect(() => chat.start(), [chat]);
  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const measure = () => setControlsHeight(controls.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(controls);
    return () => observer.disconnect();
  }, [host]);
  useLayoutEffect(() => {
    const scroll = pageRef.current?.closest<HTMLElement>('[data-testid="mobile-scroll"]');
    if (!scroll) return;
    scrollRef.current = scroll;
    const target = chat.getSnapshot().snapshot.scrollTop;
    let second = 0;
    let finishTimer = 0;
    const restore = () => {
      if (!restoring.current) return;
      scroll.scrollTop = target;
      if (scroll.scrollHeight - scroll.clientHeight >= target) {
        restoring.current = false;
        follow.current = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 80;
      }
    };
    const observer = new ResizeObserver(restore);
    if (pageRef.current) observer.observe(pageRef.current);
    const stopRestore = () => {
      restoring.current = false;
    };
    scroll.addEventListener('pointerdown', stopRestore);
    scroll.addEventListener('wheel', stopRestore);
    scroll.addEventListener('keydown', stopRestore);
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        restore();
        finishTimer = window.setTimeout(() => {
          restore();
          restoring.current = false;
        }, 15_500);
      });
    });
    const onScroll = () => {
      if (restoring.current) return;
      follow.current = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 80;
      chat.setScroll(scroll.scrollTop);
    };
    scroll.addEventListener('scroll', onScroll);
    return () => {
      observer.disconnect();
      clearTimeout(finishTimer);
      scroll.removeEventListener('pointerdown', stopRestore);
      scroll.removeEventListener('wheel', stopRestore);
      scroll.removeEventListener('keydown', stopRestore);
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      scroll.removeEventListener('scroll', onScroll);
      chat.flush();
    };
  }, [chat]);
  useLayoutEffect(() => {
    if (restoring.current || !follow.current || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [snapshot.turns, snapshot.pending, controlsHeight, bottomInset]);
  const processing = snapshot.turns.some((t) => t.status === 'PROCESSING');
  const blocked =
    busy || processing || (!!snapshot.pending && snapshot.pending.state !== 'rejected');
  const count = Array.from(snapshot.draft).length;
  const send = () => {
    follow.current = true;
    void chat.send();
  };
  const pending =
    snapshot.pending && !snapshot.turns.some((t) => t.turnId === snapshot.pending?.turnId)
      ? snapshot.pending
      : null;
  return (
    <>
      <section
        ref={bindPage}
        className="page ai-chat-page"
        style={{ paddingBottom: controlsHeight + bottomInset + 32 }}
      >
        <ScreenHeader title="선잘알 봇" onBack={onBack} />
        <p className="ai-chat-recipient">{snapshot.recipient.name}님에게 줄 선물</p>
        <div className="ai-chat-thread" aria-live="polite" aria-relevant="additions text">
          <div className="ai-chat-message assistant">
            <span className="ai-chat-avatar" aria-hidden="true">
              <img src={SUNJALAL_BOT_IMAGE} alt="" draggable={false} />
            </span>
            <div>
              <strong>선잘알 봇</strong>
              <p>안녕하세요, 선잘알 봇이에요! 🎁</p>
              <p>
                누구에게, 어떤 마음을 전하고 싶으세요? 상황과 예산을 알려주시면 같이 찾아볼게요.
              </p>
            </div>
          </div>
          <div className="ai-chat-notice">
            AI 답변은 참고용이며 정확하지 않을 수 있어요. 특정 개인을 판단할 수 있는 개인정보는
            입력하지 말아주세요.
          </div>
          {snapshot.turns.map((turn) => (
            <Fragment key={turn.turnId}>
              <div className="ai-chat-message user">
                <div>
                  <p>{turn.message}</p>
                </div>
              </div>
              <div
                className="ai-chat-message assistant"
                data-turn-id={turn.turnId}
                data-status={turn.status}
              >
                <span className="ai-chat-avatar" aria-hidden="true">
                  <img src={SUNJALAL_BOT_IMAGE} alt="" draggable={false} />
                </span>
                <div>
                  <strong>선잘알 봇</strong>
                  {turn.blocks.map((block, index) =>
                    block.type === 'text' ? (
                      <p key={index}>{block.text}</p>
                    ) : (
                      <ChatProductCards
                        key={index}
                        products={block.products}
                        states={productStates}
                        store={products}
                        onProduct={viewProduct}
                      />
                    ),
                  )}
                  {turn.progressMessage ? (
                    <p className="ai-chat-progress">{turn.progressMessage}</p>
                  ) : turn.status === 'PROCESSING' && !turn.blocks.length ? (
                    <p>답변을 준비하고 있어요.</p>
                  ) : null}
                  {turn.status === 'FAILED' ? (
                    <p>{turn.error?.message}</p>
                  ) : turn.status === 'CANCELLED' ? (
                    <p>답변 생성을 중지했습니다.</p>
                  ) : null}
                </div>
              </div>
            </Fragment>
          ))}
          {pending ? (
            <>
              <div className="ai-chat-message user">
                <div>
                  <p>{pending.body.message}</p>
                </div>
              </div>
              <p>
                {pending.state === 'unknown'
                  ? '접수 여부 확인 필요'
                  : pending.state === 'rejected'
                    ? '질문이 접수되지 않았습니다.'
                    : '질문을 접수하고 있어요.'}
              </p>
            </>
          ) : null}
        </div>
        {notice ? (
          <p className="ai-chat-status" role="status">
            {notice}
          </p>
        ) : null}
        {!busy && (snapshot.pending || processing) ? (
          <button type="button" className="secondary-button" onClick={() => void chat.retry()}>
            {snapshot.pending?.state === 'rejected' ? '같은 질문 다시 보내기' : '상태 확인'}
          </button>
        ) : null}
      </section>
      {host
        ? createPortal(
            <div
              ref={controlsRef}
              className="ai-chat-controls"
              style={{ bottom: bottomInset + 16 }}
            >
              {feedback}
              <Carousel
                className="ai-chat-suggestions"
                contentClassName="ai-suggestion-track"
                ariaLabel="추천 질문"
              >
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => chat.setDraft('친한 친구의 생일 선물을 추천해줘')}
                >
                  친구 생일 선물
                </button>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => chat.setDraft('5만원대 실용적인 선물을 추천해줘')}
                >
                  5만원대 실용적인 선물
                </button>
              </Carousel>
              <div className="ai-composer" data-scroll-drag="ignore">
                <KeyboardTextarea
                  value={snapshot.draft}
                  aria-label="채팅 메시지"
                  placeholder="메시지를 입력하세요..."
                  disabled={blocked}
                  onChange={(event) => chat.setDraft(event.target.value)}
                />
                <span className={count >= 100 ? 'limit' : count >= 90 ? 'warning' : ''}>
                  {count}/100
                </span>
                {processing ? (
                  <button
                    type="button"
                    aria-label="답변 생성 정지"
                    onClick={() => void chat.cancel()}
                  >
                    ■
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="메시지 전송"
                    disabled={blocked || !snapshot.draft.trim()}
                    onClick={send}
                  >
                    ↑
                  </button>
                )}
              </div>
            </div>,
            host,
          )
        : null}
    </>
  );
}
