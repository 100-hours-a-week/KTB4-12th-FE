import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  type PaymentCancellationStatus,
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

type CancellationCheck = {
  data: PaymentStatusResult | null;
  cancellationId: number | null;
  cancellationStatus: PaymentCancellationStatus | null;
  cancellationFailureCode: string | null;
  checked: boolean;
  checking: boolean;
  error: string;
};

function emptyCancellationCheck(): CancellationCheck {
  return {
    data: null,
    cancellationId: null,
    cancellationStatus: null,
    cancellationFailureCode: null,
    checked: false,
    checking: false,
    error: '',
  };
}

function usePaymentCancellationStatuses(orderIds: string[]) {
  const [checks, setChecks] = useState<Record<string, CancellationCheck>>({});
  const inFlight = useRef(new Set<string>());
  const pollingStartedAt = useRef(new Map<string, number>());
  const orderIdsKey = [...new Set(orderIds.filter(Boolean))].join('\n');
  const currentOrderIds = useMemo(
    () => (orderIdsKey ? orderIdsKey.split('\n') : []),
    [orderIdsKey],
  );

  const refresh = useCallback(async (orderId: string) => {
    if (inFlight.current.has(orderId)) return null;
    inFlight.current.add(orderId);
    setChecks((current) => ({
      ...current,
      [orderId]: { ...(current[orderId] ?? emptyCancellationCheck()), checking: true, error: '' },
    }));
    try {
      const data = await fetchPaymentStatus(orderId);
      if (data.cancellationStatus === 'PENDING') {
        pollingStartedAt.current.set(orderId, pollingStartedAt.current.get(orderId) ?? Date.now());
      } else {
        pollingStartedAt.current.delete(orderId);
      }
      setChecks((current) => ({
        ...current,
        [orderId]: {
          data,
          cancellationId: data.cancellationId,
          cancellationStatus: data.cancellationStatus,
          cancellationFailureCode: data.cancellationFailureCode,
          checked: true,
          checking: false,
          error: '',
        },
      }));
      return data;
    } catch (reason) {
      setChecks((current) => ({
        ...current,
        [orderId]: {
          ...(current[orderId] ?? emptyCancellationCheck()),
          checked: true,
          checking: false,
          error: reason instanceof Error ? reason.message : '취소 상태를 조회하지 못했습니다.',
        },
      }));
      return null;
    } finally {
      inFlight.current.delete(orderId);
    }
  }, []);

  const record = useCallback(
    (
      orderId: string,
      cancellation: {
        cancellationId: number | null;
        cancellationStatus: PaymentCancellationStatus;
        cancellationFailureCode: string | null;
      },
    ) => {
      if (cancellation.cancellationStatus === 'PENDING') {
        pollingStartedAt.current.set(orderId, pollingStartedAt.current.get(orderId) ?? Date.now());
      } else {
        pollingStartedAt.current.delete(orderId);
      }
      setChecks((current) => {
        const previous = current[orderId] ?? emptyCancellationCheck();
        return {
          ...current,
          [orderId]: {
            ...previous,
            data: previous.data
              ? {
                  ...previous.data,
                  cancellationId: cancellation.cancellationId,
                  cancellationStatus: cancellation.cancellationStatus,
                  cancellationFailureCode: cancellation.cancellationFailureCode,
                }
              : null,
            cancellationId: cancellation.cancellationId,
            cancellationStatus: cancellation.cancellationStatus,
            cancellationFailureCode: cancellation.cancellationFailureCode,
            checked: true,
            checking: false,
            error: '',
          },
        };
      });
    },
    [],
  );

  useEffect(() => {
    for (const orderId of currentOrderIds) {
      const check = checks[orderId];
      if (!check?.checked && !check?.checking) void refresh(orderId);
    }
  }, [checks, currentOrderIds, refresh]);

  useEffect(() => {
    const pollingIds = currentOrderIds.filter((orderId) => {
      const startedAt = pollingStartedAt.current.get(orderId);
      return (
        checks[orderId]?.cancellationStatus === 'PENDING' &&
        startedAt != null &&
        Date.now() - startedAt < 60_000
      );
    });
    if (!pollingIds.length) return;
    const timer = window.setTimeout(() => {
      pollingIds.forEach((orderId) => void refresh(orderId));
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [checks, currentOrderIds, refresh]);

  return { checks, refresh, record };
}

function cancellationMessage(check: CancellationCheck) {
  if (check.cancellationStatus === 'COMPLETED') return '취소가 완료됐어요.';
  if (check.cancellationStatus === 'DECLINED') return '취소 요청이 거절됐어요.';
  if (check.cancellationStatus === 'FAILED') return '취소 처리에 실패했어요.';
  if (check.cancellationFailureCode === 'CANCELLATION_RECONCILIATION_REQUIRED')
    return '취소 결과를 운영자가 확인하고 있어요.';
  if (check.cancellationFailureCode === 'LOCAL_COMPENSATION_FAILED')
    return '원격 취소는 확인됐고 주문 반영을 확인하고 있어요.';
  if (check.cancellationStatus === 'PENDING')
    return '취소 결과가 아직 확정되지 않았어요. 선물 상태는 그대로 유지됩니다.';
  if (check.checking) return '취소 상태를 확인하고 있어요.';
  if (check.error) return '취소 상태를 불러오지 못했어요. 상태를 다시 확인해 주세요.';
  return '';
}

function CancellationStatusNotice({
  check,
  onRefresh,
}: {
  check: CancellationCheck;
  onRefresh: () => void;
}) {
  const message = cancellationMessage(check);
  if (!message) return null;
  const canRefresh = Boolean(check.error || check.cancellationStatus === 'PENDING');
  return (
    <section className="gift-cancellation-status" role="status" aria-live="polite">
      <strong>{message}</strong>
      {check.cancellationStatus === 'PENDING' ? (
        <p>
          취소 원장 {check.cancellationId ?? '확인 중'}
          {check.cancellationFailureCode ? ` · ${check.cancellationFailureCode}` : ''}
        </p>
      ) : null}
      {check.error ? <p>{check.error}</p> : null}
      {canRefresh ? (
        <button type="button" className="text-button" disabled={check.checking} onClick={onRefresh}>
          {check.checking ? '상태 확인 중' : '취소 상태 확인'}
        </button>
      ) : null}
    </section>
  );
}

function cancellationActionAllowed(check: CancellationCheck | undefined) {
  return Boolean(
    check?.checked &&
    !check.checking &&
    !check.error &&
    check.cancellationStatus !== 'PENDING' &&
    check.cancellationStatus !== 'COMPLETED',
  );
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
  const acceptInFlight = useRef(false);
  const loader = useCallback((cursor: string | null) => fetchReceivedGifts(cursor), []);
  const list = useCursorList(loader, `received-${refreshKey}-${actionRefreshKey}`);

  const accept = async (gift: ReceivedGift) => {
    if (
      acceptInFlight.current ||
      busyGiftId != null ||
      gift.giftStatus !== 'WAITING_FOR_ACCEPTANCE'
    )
      return;
    acceptInFlight.current = true;
    setBusyGiftId(gift.giftId);
    try {
      await acceptGift(gift.giftId);
      onMessage('선물을 받았습니다.');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409)
        await fetchReceivedGiftDetail(gift.giftId).catch(() => undefined);
      onMessage(reason instanceof Error ? reason.message : '선물을 받지 못했습니다.');
    } finally {
      acceptInFlight.current = false;
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
      renderAction={(gift) => {
        if (!('sender' in gift) || gift.giftStatus !== 'WAITING_FOR_ACCEPTANCE') return null;
        return (
          <button
            type="button"
            className="primary gift-history-action"
            disabled={busyGiftId === gift.giftId}
            onClick={() => void accept(gift)}
          >
            {busyGiftId === gift.giftId ? '처리 중' : '선물 받기'}
          </button>
        );
      }}
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
  const cancelInFlight = useRef(false);
  const cancellationKeys = useRef(new Map<string, string>());
  const loader = useCallback((cursor: string | null) => fetchSentGifts(cursor), []);
  const list = useCursorList(loader, `sent-${refreshKey}-${actionRefreshKey}`);
  const orderIds = list.items
    .filter((gift) => gift.giftStatus === 'WAITING_FOR_ACCEPTANCE')
    .map((gift) => gift.orderId);
  const cancellation = usePaymentCancellationStatuses(orderIds);
  const refreshedCancellations = useRef(new Set<string>());

  useEffect(() => {
    const completed = list.items.some((gift) => {
      const orderId = gift.orderId;
      if (cancellation.checks[orderId]?.cancellationStatus !== 'COMPLETED') return false;
      if (refreshedCancellations.current.has(orderId)) return false;
      refreshedCancellations.current.add(orderId);
      return true;
    });
    if (completed) setActionRefreshKey((value) => value + 1);
  }, [cancellation.checks, list.items]);

  useEffect(() => {
    for (const gift of list.items) {
      const status = cancellation.checks[gift.orderId]?.cancellationStatus;
      if (status === 'COMPLETED' || status === 'DECLINED' || status === 'FAILED')
        cancellationKeys.current.delete(gift.orderId);
    }
  }, [cancellation.checks, list.items]);

  const cancel = async () => {
    if (
      !cancelTarget ||
      cancelInFlight.current ||
      cancelBusy ||
      !cancellationActionAllowed(cancellation.checks[cancelTarget.orderId])
    )
      return;
    cancelInFlight.current = true;
    const key = cancellationKeys.current.get(cancelTarget.orderId) ?? makeIdempotencyKey();
    cancellationKeys.current.set(cancelTarget.orderId, key);
    setCancelBusy(true);
    setCancelError('');
    try {
      const result = await cancelPayment(cancelTarget.orderId, key);
      if ('cancellationStatus' in result && result.cancellationStatus === 'PENDING') {
        cancellation.record(cancelTarget.orderId, result);
        setCancelTarget(null);
        onMessage('취소 요청을 접수했어요. 완료 여부를 확인하고 있습니다.');
        return;
      }
      cancellationKeys.current.delete(cancelTarget.orderId);
      cancellation.record(cancelTarget.orderId, {
        cancellationId: null,
        cancellationStatus: 'COMPLETED',
        cancellationFailureCode: null,
      });
      setCancelTarget(null);
      setActionRefreshKey((value) => value + 1);
      onMessage('선물 결제를 취소했습니다.');
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'CANCELLATION_IN_PROGRESS') {
        cancellationKeys.current.delete(cancelTarget.orderId);
        cancellation.record(cancelTarget.orderId, {
          cancellationId: null,
          cancellationStatus: 'PENDING',
          cancellationFailureCode: null,
        });
        setCancelTarget(null);
        await cancellation.refresh(cancelTarget.orderId);
      } else if (
        (reason instanceof ApiError && reason.status >= 500) ||
        !(reason instanceof ApiError)
      ) {
        const current = await cancellation.refresh(cancelTarget.orderId);
        if (current?.cancellationStatus === 'PENDING') {
          setCancelTarget(null);
          onMessage('취소 요청을 접수했어요. 완료 여부를 확인하고 있습니다.');
        } else {
          setCancelError(
            '취소 결과를 확인하지 못했습니다. 상태를 확인한 뒤 같은 요청으로 다시 시도해 주세요.',
          );
        }
      } else {
        setCancelError(reason.message);
      }
    } finally {
      cancelInFlight.current = false;
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
        renderAction={(gift) => {
          if (!('recipient' in gift) || gift.giftStatus !== 'WAITING_FOR_ACCEPTANCE') return null;
          const check = cancellation.checks[gift.orderId];
          const notice = check ? (
            <CancellationStatusNotice
              check={check}
              onRefresh={() => void cancellation.refresh(gift.orderId)}
            />
          ) : null;
          if (check?.cancellationStatus === 'PENDING' || check?.cancellationStatus === 'COMPLETED')
            return notice;
          return (
            <>
              {notice}
              <button
                type="button"
                className="secondary gift-history-action"
                disabled={!cancellationActionAllowed(check)}
                onClick={() => {
                  setCancelError('');
                  setCancelTarget(gift);
                }}
              >
                {cancellationActionAllowed(check)
                  ? check?.cancellationStatus
                    ? '취소 다시 요청'
                    : '선물 취소'
                  : '취소 상태 확인 중'}
              </button>
            </>
          );
        }}
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
  const loadVersion = useRef(0);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const actionInFlight = useRef(false);
  const completedCancellationNotified = useRef<string | null>(null);
  const cancellationKey = useRef<string | null>(null);
  const cancellation = usePaymentCancellationStatuses(
    !received && gift?.orderId ? [gift.orderId] : [],
  );
  const cancellationCheck = gift ? cancellation.checks[gift.orderId] : undefined;
  const payment = cancellationCheck?.data ?? null;
  const paymentError = cancellationCheck?.error ?? '';
  const orderId = gift?.orderId;

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError('');
    try {
      const next = received
        ? await fetchReceivedGiftDetail(giftId)
        : await fetchSentGiftDetail(giftId);
      if (version !== loadVersion.current) return;
      setGift(next);
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

  useEffect(() => {
    if (received || !orderId || !cancellationCheck?.checked) return;
    if (cancellationCheck.cancellationStatus === 'COMPLETED') {
      if (completedCancellationNotified.current !== orderId) {
        completedCancellationNotified.current = orderId;
        onChanged();
      }
    }
    if (
      cancellationCheck.cancellationStatus === 'COMPLETED' ||
      cancellationCheck.cancellationStatus === 'DECLINED' ||
      cancellationCheck.cancellationStatus === 'FAILED'
    )
      cancellationKey.current = null;
  }, [
    cancellationCheck?.cancellationStatus,
    cancellationCheck?.checked,
    onChanged,
    orderId,
    received,
  ]);

  const accept = async () => {
    if (
      !gift ||
      !received ||
      gift.giftStatus !== 'WAITING_FOR_ACCEPTANCE' ||
      actionInFlight.current ||
      actionBusy
    )
      return;
    actionInFlight.current = true;
    setActionBusy(true);
    try {
      await acceptGift(gift.giftId);
      onMessage('선물을 받았습니다.');
      onChanged();
    } catch (reason) {
      onMessage(reason instanceof Error ? reason.message : '선물을 받지 못했습니다.');
    } finally {
      actionInFlight.current = false;
      setActionBusy(false);
      await load();
    }
  };

  const cancel = async () => {
    if (
      !gift ||
      !('recipient' in gift) ||
      actionInFlight.current ||
      actionBusy ||
      !cancellationActionAllowed(cancellationCheck)
    )
      return;
    actionInFlight.current = true;
    cancellationKey.current ??= makeIdempotencyKey();
    setActionBusy(true);
    setCancelError('');
    try {
      const result = await cancelPayment(gift.orderId, cancellationKey.current);
      if ('cancellationStatus' in result && result.cancellationStatus === 'PENDING') {
        cancellation.record(gift.orderId, result);
        setCancelOpen(false);
        onMessage('취소 요청을 접수했어요. 완료 여부를 확인하고 있습니다.');
        return;
      }
      cancellation.record(gift.orderId, {
        cancellationId: null,
        cancellationStatus: 'COMPLETED',
        cancellationFailureCode: null,
      });
      cancellationKey.current = null;
      setCancelOpen(false);
      setGift((current) =>
        current && 'recipient' in current
          ? { ...current, giftStatus: 'CANCELED', paymentStatus: 'CANCELED' }
          : current,
      );
      await cancellation.refresh(gift.orderId);
      onMessage('선물 결제를 취소했습니다.');
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'CANCELLATION_IN_PROGRESS') {
        cancellationKey.current = null;
        cancellation.record(gift.orderId, {
          cancellationId: null,
          cancellationStatus: 'PENDING',
          cancellationFailureCode: null,
        });
        setCancelOpen(false);
        await cancellation.refresh(gift.orderId);
      } else if (
        (reason instanceof ApiError && reason.status >= 500) ||
        !(reason instanceof ApiError)
      ) {
        const status = await cancellation.refresh(gift.orderId);
        if (status?.cancellationStatus === 'PENDING') {
          setCancelOpen(false);
          onMessage('취소 요청을 접수했어요. 완료 여부를 확인하고 있습니다.');
        } else {
          setCancelError(
            '취소 결과를 확인하지 못했습니다. 상태를 확인한 뒤 같은 요청으로 다시 시도해 주세요.',
          );
        }
      } else {
        setCancelError(reason.message);
      }
    } finally {
      actionInFlight.current = false;
      setActionBusy(false);
    }
  };

  const cancellationPending = cancellationCheck?.cancellationStatus === 'PENDING';
  const cancellationCompleted = cancellationCheck?.cancellationStatus === 'COMPLETED';
  const displayedGift =
    gift && cancellationCompleted && gift.giftStatus !== 'CANCELED'
      ? {
          ...gift,
          giftStatus: 'CANCELED' as const,
          ...('recipient' in gift ? { paymentStatus: 'CANCELED' as const } : {}),
        }
      : gift;
  const waiting = displayedGift?.giftStatus === 'WAITING_FOR_ACCEPTANCE';
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
          <GiftDetailContent gift={displayedGift!} />
          {!received &&
          cancellationCheck &&
          (cancellationCheck.cancellationStatus ||
            cancellationCheck.error ||
            cancellationCheck.checking) ? (
            <CancellationStatusNotice
              check={cancellationCheck}
              onRefresh={() => void cancellation.refresh(gift.orderId)}
            />
          ) : null}
          {!received ? (
            <GiftRewardSummary
              payment={payment}
              error={
                paymentError || (!cancellationCheck?.checked ? '결제 상태를 확인하고 있어요.' : '')
              }
              onRetry={() => void cancellation.refresh(gift.orderId)}
            />
          ) : null}
          {waiting && (received || (!cancellationPending && !cancellationCompleted)) ? (
            <button
              type="button"
              className={received ? 'primary gift-detail-action' : 'secondary gift-detail-action'}
              disabled={actionBusy || (!received && !cancellationActionAllowed(cancellationCheck))}
              onClick={() => {
                if (received) void accept();
                else if (cancellationActionAllowed(cancellationCheck)) {
                  setCancelError('');
                  setCancelOpen(true);
                }
              }}
            >
              {actionBusy
                ? '처리 중'
                : !received && !cancellationActionAllowed(cancellationCheck)
                  ? '취소 상태 확인 중'
                  : received
                    ? '선물 받기'
                    : cancellationCheck?.cancellationStatus
                      ? '취소 다시 요청'
                      : '선물 취소'}
            </button>
          ) : null}
          {received && displayedGift!.giftStatus === 'COMPLETED' ? (
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
          confirmDisabled={!cancellationActionAllowed(cancellationCheck)}
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
