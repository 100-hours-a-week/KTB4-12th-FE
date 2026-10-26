import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import {
  acceptGift,
  cancelPayment,
  fetchPaymentStatus,
  fetchReceivedGiftDetail,
  fetchReceivedGifts,
  fetchSentGiftDetail,
  fetchSentGifts,
  GiftDetailContent,
  GiftHistoryCard,
  type PaymentStatusResult,
  type ReceivedGift,
  type SentGift,
} from '../../../entities/gift';
import { GiftReviewSection } from '../../../features/review-gift';
import { ApiError } from '../../../shared/api/client';
import { useCursorList } from '../../../shared/lib/useCursorList';
import { AppDialog, AsyncContentState, InfiniteCursor, ScreenHeader } from '../../../shared/ui';

type ListPageProps = {
  onBack: () => void;
  onSelect: (giftId: number) => void;
  onMessage: (message: string) => void;
  refreshKey?: number;
  processingPayment?: boolean;
  action?: ReactNode;
};

function makeIdempotencyKey() {
  return crypto.randomUUID();
}

export function ReceivedGiftsPage({
  onBack,
  onSelect,
  onMessage,
  refreshKey = 0,
  action,
}: ListPageProps) {
  const [actionRefreshKey, setActionRefreshKey] = useState(0);
  const [busyGiftId, setBusyGiftId] = useState<number | null>(null);
  const loader = useCallback((cursor: string | null) => fetchReceivedGifts(cursor), []);
  const list = useCursorList(loader, `received-${refreshKey}-${actionRefreshKey}`);

  const accept = async (gift: ReceivedGift) => {
    if (busyGiftId != null) return;
    setBusyGiftId(gift.giftId);
    try {
      await acceptGift(gift.giftId);
      onMessage('선물을 받았습니다.');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409)
        await fetchReceivedGiftDetail(gift.giftId).catch(() => undefined);
      onMessage(reason instanceof Error ? reason.message : '선물을 받지 못했습니다.');
    } finally {
      setBusyGiftId(null);
      setActionRefreshKey((value) => value + 1);
    }
  };

  return (
    <GiftListPage
      title="받은 선물"
      emptyLabel="아직 받은 선물이 없어요"
      items={list.items}
      action={action}
      onBack={onBack}
      onSelect={onSelect}
      cursor={list}
      renderAction={(gift) =>
        'sender' in gift && gift.giftStatus === 'WAITING_FOR_ACCEPTANCE' ? (
          <button
            type="button"
            className="primary gift-history-action"
            disabled={busyGiftId === gift.giftId}
            onClick={() => void accept(gift)}
          >
            {busyGiftId === gift.giftId ? '처리 중' : '선물 받기'}
          </button>
        ) : null
      }
    />
  );
}

export function SentGiftsPage({
  onBack,
  onSelect,
  onMessage,
  refreshKey = 0,
  processingPayment = false,
  action,
}: ListPageProps) {
  const [actionRefreshKey, setActionRefreshKey] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<SentGift | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const cancellationKeys = useRef(new Map<string, string>());
  const loader = useCallback((cursor: string | null) => fetchSentGifts(cursor), []);
  const list = useCursorList(loader, `sent-${refreshKey}-${actionRefreshKey}`);

  const cancel = async () => {
    if (!cancelTarget || cancelBusy) return;
    const key = cancellationKeys.current.get(cancelTarget.orderId) ?? makeIdempotencyKey();
    cancellationKeys.current.set(cancelTarget.orderId, key);
    setCancelBusy(true);
    setCancelError('');
    try {
      await cancelPayment(cancelTarget.orderId, key);
      cancellationKeys.current.delete(cancelTarget.orderId);
      setCancelTarget(null);
      setActionRefreshKey((value) => value + 1);
      onMessage('선물 결제를 취소했습니다.');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        await fetchSentGiftDetail(cancelTarget.giftId).catch(() => undefined);
        setCancelTarget(null);
        setActionRefreshKey((value) => value + 1);
      } else {
        setCancelError(
          reason instanceof ApiError && reason.code !== 'PAYMENT_RESULT_UNCONFIRMED'
            ? reason.message
            : '취소 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.',
        );
      }
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <>
      <GiftListPage
        title="보낸 선물"
        emptyLabel="아직 보낸 선물이 없어요"
        items={list.items}
        action={action}
        onBack={onBack}
        onSelect={onSelect}
        cursor={list}
        notice={processingPayment ? '결제 처리 중인 선물이 있어요.' : undefined}
        renderAction={(gift) =>
          'recipient' in gift && gift.giftStatus === 'WAITING_FOR_ACCEPTANCE' ? (
            <button
              type="button"
              className="secondary gift-history-action"
              onClick={() => {
                setCancelError('');
                setCancelTarget(gift);
              }}
            >
              선물 취소
            </button>
          ) : null
        }
      />
      {cancelTarget ? (
        <AppDialog
          title="선물을 취소할까요?"
          body={cancelError || `${cancelTarget.recipient.name}님에게 보낸 선물 결제를 취소합니다.`}
          cancelLabel="돌아가기"
          confirmLabel={cancelError ? '다시 시도' : '취소하기'}
          busy={cancelBusy}
          danger
          onCancel={() => {
            if (!cancelBusy) setCancelTarget(null);
          }}
          onConfirm={() => void cancel()}
        />
      ) : null}
    </>
  );
}

function GiftListPage({
  title,
  emptyLabel,
  items,
  action,
  onBack,
  onSelect,
  cursor,
  renderAction,
  notice,
}: {
  title: string;
  emptyLabel: string;
  items: Array<ReceivedGift | SentGift>;
  action?: ReactNode;
  onBack: () => void;
  onSelect: (giftId: number) => void;
  cursor: ReturnType<typeof useCursorList<ReceivedGift | SentGift>>;
  renderAction: (gift: ReceivedGift | SentGift) => ReactNode;
  notice?: string;
}) {
  return (
    <section className="page gift-history-page">
      <ScreenHeader title={title} onBack={onBack} action={action} />
      {notice ? <p className="gift-payment-processing">{notice}</p> : null}
      <div className="gift-history-list">
        {items.map((gift) => (
          <div className="gift-history-item" key={gift.giftId}>
            <GiftHistoryCard gift={gift} onClick={() => onSelect(gift.giftId)} />
            {renderAction(gift)}
          </div>
        ))}
      </div>
      <InfiniteCursor
        {...cursor}
        itemCount={items.length}
        emptyLabel={emptyLabel}
        onLoadMore={cursor.loadMore}
        onRetry={cursor.retry}
      />
    </section>
  );
}

type DetailPageProps = {
  giftId: number;
  refreshKey?: number;
  onBack: () => void;
  onMessage: (message: string) => void;
  onChanged: () => void;
  action?: ReactNode;
};

export function ReceivedGiftDetailPage(props: DetailPageProps) {
  return <GiftDetailPage key={props.giftId} {...props} received />;
}

export function SentGiftDetailPage(props: DetailPageProps) {
  return <GiftDetailPage key={props.giftId} {...props} received={false} />;
}

function GiftDetailPage({
  giftId,
  refreshKey = 0,
  onBack,
  onMessage,
  onChanged,
  action,
  received,
}: DetailPageProps & { received: boolean }) {
  const [gift, setGift] = useState<ReceivedGift | SentGift | null>(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentStatusResult | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const loadVersion = useRef(0);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const cancellationKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError('');
    setPayment(null);
    setPaymentError('');
    try {
      const next = received
        ? await fetchReceivedGiftDetail(giftId)
        : await fetchSentGiftDetail(giftId);
      if (version !== loadVersion.current) return;
      setGift(next);
      if (!received) {
        try {
          const status = await fetchPaymentStatus(next.orderId);
          if (version === loadVersion.current) setPayment(status);
        } catch (reason) {
          if (version === loadVersion.current)
            setPaymentError(
              reason instanceof Error ? reason.message : '보상 정보를 불러오지 못했습니다.',
            );
        }
      }
    } catch (reason) {
      if (version === loadVersion.current)
        setError(reason instanceof Error ? reason.message : '선물 정보를 불러오지 못했습니다.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [giftId, received]);

  useEffect(() => {
    void load();
    return () => {
      loadVersion.current += 1;
    };
  }, [load, refreshKey]);

  const accept = async () => {
    if (!gift || actionBusy) return;
    setActionBusy(true);
    try {
      await acceptGift(gift.giftId);
      onMessage('선물을 받았습니다.');
      onChanged();
    } catch (reason) {
      onMessage(reason instanceof Error ? reason.message : '선물을 받지 못했습니다.');
    } finally {
      setActionBusy(false);
      await load();
    }
  };

  const cancel = async () => {
    if (!gift || !('recipient' in gift) || actionBusy) return;
    cancellationKey.current ??= makeIdempotencyKey();
    setActionBusy(true);
    setCancelError('');
    try {
      await cancelPayment(gift.orderId, cancellationKey.current);
      cancellationKey.current = null;
      setCancelOpen(false);
      onMessage('선물 결제를 취소했습니다.');
      onChanged();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) setCancelOpen(false);
      else
        setCancelError(
          reason instanceof ApiError && reason.code !== 'PAYMENT_RESULT_UNCONFIRMED'
            ? reason.message
            : '취소 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.',
        );
    } finally {
      setActionBusy(false);
      await load();
    }
  };

  const waiting = gift?.giftStatus === 'WAITING_FOR_ACCEPTANCE';
  return (
    <section className="page gift-detail-page">
      <ScreenHeader
        title={received ? '받은 선물 상세' : '보낸 선물 상세'}
        onBack={onBack}
        action={action}
      />
      <AsyncContentState loading={loading} error={error} onRetry={() => void load()} />
      {!loading && !error && gift ? (
        <div className="gift-detail-surface">
          <GiftDetailContent gift={gift} />
          {!received ? (
            <GiftRewardSummary payment={payment} error={paymentError} onRetry={() => void load()} />
          ) : null}
          {waiting ? (
            <button
              type="button"
              className={received ? 'primary gift-detail-action' : 'secondary gift-detail-action'}
              disabled={actionBusy}
              onClick={() => {
                if (received) void accept();
                else {
                  setCancelError('');
                  setCancelOpen(true);
                }
              }}
            >
              {actionBusy ? '처리 중' : received ? '선물 받기' : '선물 취소'}
            </button>
          ) : null}
          {received && gift.giftStatus === 'COMPLETED' ? (
            <GiftReviewSection giftId={giftId} />
          ) : null}
        </div>
      ) : null}
      {cancelOpen && gift && 'recipient' in gift ? (
        <AppDialog
          title="선물을 취소할까요?"
          body={cancelError || `${gift.recipient.name}님에게 보낸 선물 결제를 취소합니다.`}
          cancelLabel="돌아가기"
          confirmLabel={cancelError ? '다시 시도' : '취소하기'}
          busy={actionBusy}
          danger
          onCancel={() => {
            if (!actionBusy) setCancelOpen(false);
          }}
          onConfirm={() => void cancel()}
        />
      ) : null}
    </section>
  );
}

function GiftRewardSummary({
  payment,
  error,
  onRetry,
}: {
  payment: PaymentStatusResult | null;
  error: string;
  onRetry: () => void;
}) {
  const paid = payment?.rewardAmount != null;
  const restored = payment?.couponStatus === 'RESTORED';
  const canceled = payment?.paymentStatus === 'CANCELED' || payment?.paymentStatus === 'DECLINED';
  return (
    <section className="gift-reward-summary" aria-label="선물 보상">
      <div className="gift-reward-heading">
        <h2>선물 보상</h2>
        {payment ? (
          <span>
            {paid
              ? '지급 완료'
              : canceled
                ? '미지급'
                : payment.expectedRewardAmount != null
                  ? '수락 대기'
                  : '결과 확인 중'}
          </span>
        ) : null}
      </div>
      {error || !payment ? (
        <p role="alert">{error || '보상 정보를 확인하지 못했습니다.'}</p>
      ) : (
        <>
          <dl>
            <dt>{restored ? '복구된 쿠폰' : paid ? '사용 쿠폰' : '적용 쿠폰'}</dt>
            <dd>
              {payment.couponMultiplier ? `${payment.couponMultiplier}배 쿠폰` : '쿠폰 미사용'}
            </dd>
            <dt>{paid ? '지급된 보상' : '수락 시 예상 보상'}</dt>
            <dd className="gift-reward-amount">
              {paid
                ? `${payment.rewardAmount!.toLocaleString()} 크레딧`
                : payment.expectedRewardAmount != null
                  ? `${payment.expectedRewardAmount.toLocaleString()} 크레딧`
                  : '—'}
            </dd>
          </dl>
          <p>
            {paid
              ? '보낸 분에게 크레딧이 지급되었습니다.'
              : restored
                ? '사용한 쿠폰이 복구되었습니다. 보상은 지급되지 않았습니다.'
                : canceled
                  ? '취소된 선물에는 보상이 지급되지 않습니다.'
                  : payment.expectedRewardAmount != null
                    ? '상대방이 선물을 수락하면 지급됩니다.'
                    : '결제 결과를 확인 중입니다. 보상은 아직 지급되지 않았습니다.'}
          </p>
        </>
      )}
      {error ? (
        <button type="button" className="text-button" onClick={onRetry}>
          보상 다시 조회
        </button>
      ) : null}
    </section>
  );
}
