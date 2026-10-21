import { ProductImage } from '../../../shared/ui';
import type { ReceivedGift, SentGift } from '../model';

type HistoryGift = ReceivedGift | SentGift;

function getGiftImage(gift: HistoryGift) {
  return gift.product.thumbnailUrl ?? gift.product.imageUrl ?? '';
}

function isReceived(gift: HistoryGift): gift is ReceivedGift {
  return 'sender' in gift;
}

function formatExpiresAt(expiresAt: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(expiresAt));
}

function GiftState({ gift }: { gift: HistoryGift }) {
  const received = isReceived(gift);
  const paymentStatus = received
    ? null
    : (gift.paymentStatus ?? (gift.giftStatus === 'CANCELED' ? 'CANCELED' : 'COMPLETED'));
  return (
    <div className="gift-state">
      <span className={`gift-status ${gift.giftStatus.toLowerCase()}`}>
        {
          {
            WAITING_FOR_ACCEPTANCE: received ? '받기 대기' : '수락 대기',
            COMPLETED: '수락 완료',
            CANCELED: '취소됨',
          }[gift.giftStatus]
        }
      </span>
      {!received ? (
        <span className={`payment-status ${paymentStatus === 'COMPLETED' ? 'completed' : ''}`}>
          {paymentStatus === 'PENDING'
            ? '결제 처리 중'
            : paymentStatus === 'CANCELED'
              ? '결제 취소'
              : '결제 완료'}
        </span>
      ) : null}
      {gift.giftStatus === 'WAITING_FOR_ACCEPTANCE' ? (
        <small>수락 기한 {formatExpiresAt(gift.expiresAt)}</small>
      ) : null}
    </div>
  );
}

export function GiftHistoryCard({ gift, onClick }: { gift: HistoryGift; onClick: () => void }) {
  const received = isReceived(gift);
  const person = received ? gift.sender.name : gift.recipient.name;
  const date = received ? gift.receivedAt : gift.sentAt;
  return (
    <button type="button" className="gift-history-card" onClick={onClick}>
      <strong>{received ? `from. ${person}` : `to. ${person}`}</strong>
      <div>
        <ProductImage src={getGiftImage(gift)} alt={gift.product.name} />
        <p>
          <small>{gift.product.brand}</small>
          <b>{gift.product.name}</b>
          <span>수량 {gift.quantity}개</span>
        </p>
      </div>
      <time dateTime={date}>
        {received ? '받은 날짜' : '보낸 날짜'}: {new Date(date).toLocaleDateString('ko-KR')}
      </time>
      <GiftState gift={gift} />
    </button>
  );
}

export function GiftDetailContent({ gift }: { gift: HistoryGift }) {
  const received = isReceived(gift);
  const person = received ? gift.sender.name : gift.recipient.name;
  const date = received ? gift.receivedAt : gift.sentAt;
  return (
    <div className="gift-detail-content">
      <article className="gift-person-card">
        <span>{received ? '보낸 사람' : '받은 사람'}</span>
        <strong>{person || '알 수 없음'}</strong>
        <time dateTime={date}>{new Date(date).toLocaleDateString('ko-KR')}</time>
      </article>
      <article className="gift-detail-card">
        <div className="gift-product-summary">
          <ProductImage
            className="gift-detail-image"
            src={getGiftImage(gift)}
            alt={gift.product.name}
          />
          <div className="gift-product-identity">
            <small>{gift.product.brand || '알 수 없음'}</small>
            <strong>{gift.product.name || '알 수 없음'}</strong>
          </div>
        </div>
        <dl>
          <dt>수량</dt>
          <dd>{gift.quantity}개</dd>
          {!received ? (
            <>
              <dt>단일 가격</dt>
              <dd>{gift.unitPrice.toLocaleString()}원</dd>
              <dt>총 가격</dt>
              <dd>{gift.totalPrice.toLocaleString()}원</dd>
            </>
          ) : null}
        </dl>
        <GiftState gift={gift} />
      </article>
    </div>
  );
}
