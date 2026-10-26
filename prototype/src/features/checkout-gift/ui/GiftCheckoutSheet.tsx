import { Cross1Icon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';

import {
  type CouponInventory,
  type CouponMultiplier,
  createPayment,
  fetchCoupons,
  fetchPaymentStatus,
  getGiftConditionError,
  type GiftPreflight,
} from '../../../entities/gift';
import { BottomSheet } from '../../../mobile';
import { ApiError } from '../../../shared/api/client';
import { loadSession } from '../../../shared/api/session';
import { ProductImage } from '../../../shared/ui';
import { clearPendingCheckout, getPendingCheckout, savePendingCheckout } from '../pendingCheckout';

type Props = {
  preflight: GiftPreflight;
  productName: string;
  imageUrl: string;
  onClose: () => void;
  onComplete: (giftId: number) => void;
  onConditionError: (code: string) => void;
  onPendingChange: (pending: boolean) => void;
};

export function GiftCheckoutSheet(props: Props) {
  const [attempt, setAttempt] = useState(getPendingCheckout);
  const [selection, setSelection] = useState<CouponMultiplier | null>(
    attempt?.input.couponMultiplier ?? null,
  );
  const [inventory, setInventory] = useState<CouponInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [couponError, setCouponError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const active = useRef(true);
  const sending = useRef(false);
  const preflight = attempt?.preflight ?? props.preflight;
  const productName = attempt?.productName ?? props.productName;
  const imageUrl = attempt?.imageUrl ?? props.imageUrl;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    void fetchCoupons()
      .then((result) => {
        if (current) setInventory(result);
      })
      .catch((reason: unknown) => {
        if (current) {
          setInventory(null);
          if (!getPendingCheckout()) setSelection(null);
          setCouponError(reason instanceof Error ? reason.message : '쿠폰을 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [reloadKey]);

  const release = () => {
    clearPendingCheckout();
    setAttempt(null);
    setSelection(null);
    props.onPendingChange(false);
    setLoading(true);
    setCouponError('');
    setReloadKey((key) => key + 1);
  };

  const submit = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    let current = attempt;
    try {
      if (!current) {
        current = {
          userId: loadSession()?.user?.userId ?? null,
          key: crypto.randomUUID(),
          input: {
            productId: preflight.product.productId,
            recipientUserId: preflight.recipient.userId,
            quantity: preflight.product.quantity,
            expectedUnitPrice: preflight.product.unitPrice,
            ...(selection && !couponError ? { couponMultiplier: selection } : {}),
          },
          preflight,
          productName,
          imageUrl,
          orderId: null,
        };
        savePendingCheckout(current);
        setAttempt(current);
        props.onPendingChange(true);
      }

      if (current.orderId) {
        const result = await fetchPaymentStatus(current.orderId);
        if (!active.current) return;
        if (result.paymentStatus === 'COMPLETED' && result.giftId != null) {
          clearPendingCheckout();
          props.onPendingChange(false);
          props.onComplete(result.giftId);
        } else if (result.paymentStatus === 'DECLINED' || result.paymentStatus === 'CANCELED') {
          release();
          setError(
            result.paymentStatus === 'DECLINED'
              ? '결제가 승인되지 않았습니다.'
              : '결제가 취소되었습니다.',
          );
        } else setError('결제 결과를 확인 중입니다. 잠시 후 같은 요청의 상태를 확인해 주세요.');
        return;
      }

      const result = await createPayment(current.input, current.key);
      if (!active.current) return;
      if ('approvalResult' in result) {
        const pending = { ...current, orderId: result.orderId };
        savePendingCheckout(pending);
        setAttempt(pending);
        setError('결제 결과를 확인 중입니다. 잠시 후 같은 요청의 상태를 확인해 주세요.');
      } else {
        clearPendingCheckout();
        props.onPendingChange(false);
        props.onComplete(result.giftId);
      }
    } catch (reason) {
      if (!active.current) return;
      const definiteFailure =
        reason instanceof ApiError &&
        [400, 403, 404, 422].includes(reason.status) &&
        reason.code !== 'PAYMENT_RESULT_UNCONFIRMED';
      const conditionError = reason instanceof ApiError && getGiftConditionError(reason.code);
      // 재시도에서 받은 입력·권한 오류만으로 앞선 요청의 성공 가능성을 지우지 않는다.
      const canRelease =
        !current?.orderId &&
        ((!attempt && (definiteFailure || conditionError)) ||
          (reason instanceof ApiError && reason.code === 'PAYMENT_DECLINED'));
      if (canRelease) release();
      if (canRelease && conditionError && reason instanceof ApiError)
        props.onConditionError(reason.code!);
      else setError(reason instanceof Error ? reason.message : '결제 결과를 확인하지 못했습니다.');
    } finally {
      sending.current = false;
      if (active.current) setBusy(false);
    }
  };

  const options = inventory?.coupons.filter((coupon) => coupon.quantity > 0) ?? [];
  const reservedSelection = attempt?.input.couponMultiplier;
  const expectedReward = inventory ? inventory.baseRewardAmount * (selection ?? 1) : null;
  return (
    <BottomSheet
      open
      onOpenChange={(open) => {
        if (!open && !sending.current) props.onClose();
      }}
      title={`${preflight.recipient.name}님에게 이 선물을 보낼까요?`}
      snap={0.9}
    >
      <button
        type="button"
        className="sheet-close"
        aria-label="결제 확인 닫기"
        disabled={busy}
        onClick={() => {
          if (!sending.current) props.onClose();
        }}
      >
        <Cross1Icon />
      </button>
      <div className="coupon-checkout">
        <div className="checkout-product">
          <ProductImage src={imageUrl} alt={productName} />
          <div>
            <strong>{productName}</strong>
            <span>수량 {preflight.product.quantity}개</span>
          </div>
        </div>
        <dl className="checkout-price">
          <dt>결제 금액</dt>
          <dd>{preflight.product.totalPrice.toLocaleString()}원</dd>
        </dl>
        <fieldset
          className="coupon-options"
          disabled={busy || Boolean(attempt) || loading || Boolean(couponError)}
        >
          <legend>보상 쿠폰</legend>
          <label>
            <input
              type="radio"
              name="coupon"
              checked={selection === null}
              onChange={() => setSelection(null)}
            />
            <span>사용하지 않음</span>
          </label>
          {options.map((coupon) => (
            <label key={coupon.multiplier}>
              <input
                type="radio"
                name="coupon"
                checked={selection === coupon.multiplier}
                onChange={() => setSelection(coupon.multiplier)}
              />
              <span>{coupon.multiplier}배 쿠폰</span>
              <small>보유 {coupon.quantity}개</small>
            </label>
          ))}
          {reservedSelection && !options.some((item) => item.multiplier === reservedSelection) ? (
            <label>
              <input type="radio" name="coupon" checked readOnly />
              <span>{reservedSelection}배 쿠폰</span>
              <small>이 결제에 선택됨</small>
            </label>
          ) : null}
        </fieldset>
        {loading ? (
          <p role="status" className="checkout-note">
            보유 쿠폰을 불러오는 중이에요.
          </p>
        ) : null}
        {couponError ? (
          <div className="checkout-error" role="alert">
            <p>{couponError}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setCouponError('');
                setReloadKey((key) => key + 1);
              }}
            >
              쿠폰 다시 조회
            </button>
          </div>
        ) : null}
        {!loading && !couponError && options.length === 0 && !reservedSelection ? (
          <p className="checkout-note">사용 가능한 쿠폰이 없습니다.</p>
        ) : null}
        <div className="checkout-reward">
          <span>상대방 수락 시 예상 보상</span>
          <strong>
            {expectedReward == null
              ? '확인하지 못했어요'
              : `${expectedReward.toLocaleString()} 크레딧`}
          </strong>
          <p>
            쿠폰은 선물 보상에 적용됩니다.
            <br />
            상대방이 수락하면 지급됩니다.
          </p>
        </div>
        {attempt ? (
          <p className="checkout-note">결제 결과가 확정될 때까지 선택한 쿠폰을 유지합니다.</p>
        ) : null}
        {error ? (
          <p className="checkout-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="primary checkout-submit"
          disabled={busy || (loading && !attempt)}
          onClick={() => void submit()}
        >
          {busy
            ? '처리 중…'
            : attempt
              ? '같은 결제 결과 확인'
              : couponError
                ? '쿠폰 없이 선물 보내기'
                : '선물 보내기'}
        </button>
      </div>
    </BottomSheet>
  );
}
