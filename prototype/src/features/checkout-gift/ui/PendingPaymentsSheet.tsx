import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchPaymentStatus,
  type PaymentStatusResult,
  type PendingPaymentOrder,
} from '../../../entities/gift';
import { BottomSheet } from '../../../mobile';
import { getPaymentStatusMessage } from '../paymentStatusMessage';

type Props = {
  orders: PendingPaymentOrder[];
  onClose: () => void;
  onResolve: (orderId: string, payment: PaymentStatusResult) => void;
};

export function PendingPaymentsSheet({ orders, onClose, onResolve }: Props) {
  const [displayOrders] = useState(orders);
  const [payments, setPayments] = useState<Record<string, PaymentStatusResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [automaticChecksDone, setAutomaticChecksDone] = useState(false);
  const active = useRef(true);
  const checking = useRef(false);
  const paymentsRef = useRef<Record<string, PaymentStatusResult>>({});

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const refreshStatuses = useCallback(async () => {
    if (checking.current) return;
    const unresolved = displayOrders.filter((order) => {
      const status = paymentsRef.current[order.orderId]?.paymentStatus;
      return !status || status === 'PENDING';
    });
    if (!unresolved.length) return;
    checking.current = true;
    setBusy(true);
    type StatusCheckResult =
      { orderId: string; payment: PaymentStatusResult } | { orderId: string; error: string };
    const results: StatusCheckResult[] = await Promise.all(
      unresolved.map(async ({ orderId }) => {
        try {
          return { orderId, payment: await fetchPaymentStatus(orderId) };
        } catch (reason) {
          return {
            orderId,
            error: reason instanceof Error ? reason.message : '결제 상태를 확인하지 못했습니다.',
          };
        }
      }),
    );
    if (active.current) {
      const nextPayments = { ...paymentsRef.current };
      results.forEach((result) => {
        if ('payment' in result) nextPayments[result.orderId] = result.payment;
      });
      paymentsRef.current = nextPayments;
      setPayments(nextPayments);
      setErrors((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if ('error' in result) next[result.orderId] = result.error;
          else delete next[result.orderId];
        });
        return next;
      });
      results.forEach((result) => {
        if (
          'payment' in result &&
          result.payment.paymentStatus !== 'PENDING' &&
          result.payment.failureCode !== 'PAYMENT_RECONCILIATION_REQUIRED'
        )
          onResolve(result.orderId, result.payment);
      });
    }
    checking.current = false;
    if (active.current) setBusy(false);
  }, [displayOrders, onResolve]);

  useEffect(() => {
    const autoCheckDeadline = Date.now() + 60_000;
    void refreshStatuses();
    const timer = window.setInterval(() => {
      if (Date.now() >= autoCheckDeadline) {
        window.clearInterval(timer);
        setAutomaticChecksDone(true);
        return;
      }
      void refreshStatuses();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [displayOrders, refreshStatuses]);

  return (
    <BottomSheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title="결제 상태 확인"
      description="결제 명령은 다시 보내지 않고 주문 상태만 조회합니다."
      snap={0.8}
    >
      <div className="pending-payment-list">
        {displayOrders.map((order) => {
          const payment = payments[order.orderId];
          const error = errors[order.orderId];
          return (
            <article className="pending-payment-item" key={order.orderId}>
              <div>
                <strong>
                  {payment ? getPaymentStatusMessage(payment) : '결제 상태를 확인하고 있어요.'}
                </strong>
                <span>주문 번호 · {order.orderId}</span>
                {error ? <p role="alert">{error} 결제 요청은 다시 보내지 않았어요.</p> : null}
              </div>
              {payment?.paymentStatus === 'PENDING' ? (
                <small>미확정</small>
              ) : payment ? (
                <small>확정</small>
              ) : null}
            </article>
          );
        })}
        <p className="checkout-note" role="status">
          {automaticChecksDone
            ? '자동 확인을 마쳤어요. 아래 버튼으로 상태를 다시 확인할 수 있습니다.'
            : '5초 간격으로 최대 1분 동안 상태를 확인합니다.'}
        </p>
        <button
          type="button"
          className="primary checkout-submit"
          disabled={busy}
          onClick={() => void refreshStatuses()}
        >
          {busy ? '상태 확인 중…' : '결제 상태 다시 확인'}
        </button>
      </div>
    </BottomSheet>
  );
}
