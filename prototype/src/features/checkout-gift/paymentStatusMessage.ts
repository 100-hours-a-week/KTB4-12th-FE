import type { PaymentStatusResult } from '../../entities/gift';

type PaymentState = Pick<PaymentStatusResult, 'paymentStatus' | 'approvalResult'> & {
  failureCode?: string | null;
};

export function getPaymentStatusMessage(payment: PaymentState) {
  if (payment.failureCode === 'PAYMENT_RECONCILIATION_REQUIRED')
    return '결제 결과에 추가 확인이 필요해요. 운영팀이 확인하고 있습니다.';
  if (payment.paymentStatus === 'COMPLETED') return '결제가 완료됐어요.';
  if (payment.paymentStatus === 'DECLINED' || payment.approvalResult === 'DECLINED')
    return '결제가 승인되지 않았어요.';
  if (payment.paymentStatus === 'CANCELED') return '결제가 취소됐어요.';
  if (payment.approvalResult === 'APPROVED')
    return '결제 승인은 확인됐어요. 주문 처리를 마무리하고 있습니다.';
  if (payment.paymentStatus === 'FAILED') return '결제 처리에 실패했어요.';
  return '결제 승인 여부를 확인하고 있어요.';
}
