import { ProductImage } from '../../../shared/ui';
import type { ReceivedGift, SentGift } from '../model';

type HistoryGift = ReceivedGift | SentGift;

function getGiftImage(gift: HistoryGift) {
  return gift.product.thumbnailUrl ?? gift.product.imageUrl ?? '';
}

function isReceived(gift: HistoryGift): gift is ReceivedGift {
  return 'sender' in gift;
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
      <ProductImage
        className="gift-detail-image"
        src={getGiftImage(gift)}
        alt={gift.product.name}
      />
      <article className="gift-detail-card">
        <small>{gift.product.brand || '알 수 없음'}</small>
        <strong>{gift.product.name || '알 수 없음'}</strong>
        <dl>
          <dt>수량</dt>
          <dd>{gift.quantity}개</dd>
          <dt>단일 가격</dt>
          <dd>{gift.unitPrice.toLocaleString()}원</dd>
          <dt>총 가격</dt>
          <dd>{gift.totalPrice.toLocaleString()}원</dd>
        </dl>
      </article>
    </div>
  );
}
